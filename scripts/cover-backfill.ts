// Backfill de capas: ~18.5k obras do catálogo (todas com ID AniList numérico) ficaram
// sem capa porque um backfill antigo salvou coverImage nulo — a AniList TEM as imagens.
// Estratégia ADITIVA (nunca apaga, nunca sobrescreve dado bom):
//   - busca em lotes de 50 ids (media(id_in)) só as obras com cover vazio;
//   - atualiza cover/coverColor (sempre) e banner (só se ainda é null);
//   - respeita rate limit da AniList (2.2s entre lotes) e tem teto de runtime por
//     invocação — idempotente: a próxima passada continua de onde parou.
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const BATCH = 50;
const GAP_MS = 3_200; // 50 ids/lote a 3.2s ≈ 19 req/min — folga sob o rate limit atual da AniList
// invocação manual com --full ignora o teto (cron usa o teto para não disputar RAM)
const RUNTIME_CAP_MS = process.argv.includes("--full") ? Infinity : 7 * 60_000;

interface AniListMedia {
  id: number;
  coverImage?: { extraLarge?: string | null; large?: string | null; color?: string | null } | null;
  bannerImage?: string | null;
}

async function fetchBatch(ids: string[]): Promise<AniListMedia[]> {
  const res = await fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `query ($ids: [Int]) { Page(perPage: ${BATCH}) { media(id_in: $ids) { id coverImage { extraLarge large color } bannerImage } } }`,
      variables: { ids: ids.map(Number) },
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
  const json: any = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0]?.message ?? "erro AniList");
  return json.data?.Page?.media ?? [];
}

async function main() {
  const t0 = Date.now();
  const pending = await db.work.findMany({
    where: { cover: "" },
    select: { id: true, banner: true },
    orderBy: { popularity: "desc" },
  });
  console.log(`capas faltando: ${pending.length} — backfill em lotes de ${BATCH} (teto ${RUNTIME_CAP_MS / 60000} min/invocação)`);
  if (!pending.length) {
    console.log("nada a fazer — catálogo completo");
    return;
  }

  let fixed = 0, noCover = 0, batches = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    if (Date.now() - t0 > RUNTIME_CAP_MS) {
      console.log(`teto de runtime atingido — ${pending.length - i} restantes para a próxima invocação`);
      break;
    }
    const slice = pending.slice(i, i + BATCH);
    let media: AniListMedia[] = [];
    try {
      media = await fetchBatch(slice.map((w) => w.id));
    } catch (e: any) {
      console.warn("lote falhou (segue):", e.message);
      await new Promise((r) => setTimeout(r, 5_000));
      continue;
    }
    const byId = new Map(media.map((m) => [String(m.id), m]));
    for (const w of slice) {
      const m = byId.get(w.id);
      const cover = m?.coverImage?.extraLarge ?? m?.coverImage?.large ?? "";
      if (!cover) { noCover++; continue; }
      await db.work.update({
        where: { id: w.id },
        data: {
          cover, // capa vazia → real (update em obra SEM capa: aditivo por definição)
          coverColor: m?.coverImage?.color ?? undefined,
          banner: w.banner ? undefined : (m?.bannerImage ?? undefined),
        },
      }).catch(() => {});
      fixed++;
    }
    batches++;
    if (batches % 10 === 0) console.log(`  … ${Math.min(i + BATCH, pending.length)}/${pending.length} processados, ${fixed} capas restauradas`);
    await new Promise((r) => setTimeout(r, GAP_MS)); // rate limit AniList
  }
  console.log(`✓ backfill de capas: ${fixed} restauradas, ${noCover} sem capa na fonte (lotes: ${batches})`);
}

main().finally(() => db.$disconnect());
