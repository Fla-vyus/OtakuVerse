// Backfill de integridade do catálogo OtakuVerse.
// 1) Regenera sinopse (EN=PT) das obras procedurais com a engine corrigida
// 2) Preenche siteUrl (busca AniList) e coverColor (hex determinístico)
// 3) Dedupica autores por nome (42 obras reais tinham staff repetido)
import { PrismaClient } from "@prisma/client";
import { buildSynopsis, hashStr } from "./synopsis-engine";

const db = new PrismaClient();

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to255 = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to255(f(0))}${to255(f(8))}${to255(f(4))}`;
}

async function main() {
  const t0 = Date.now();
  const works = await db.work.findMany({
    where: { id: { startsWith: "g" } },
    select: { id: true, title: true, type: true, country: true, genres: true, spicy: true, status: true, chapters: true, volumes: true, episodes: true, synopsis: true, synopsisPT: true, siteUrl: true, coverColor: true },
  });
  console.log(`Obras procedurais: ${works.length}`);

  const needSynopsis = works.filter((w) => !w.synopsis || !w.synopsisPT || w.synopsisPT.includes("de a ") || w.synopsisPT.includes("no Estação"));
  const needMeta = works.filter((w) => !w.siteUrl || !w.coverColor);
  console.log(`Sem sinopse/gramática ruim: ${needSynopsis.length} · sem siteUrl/coverColor: ${needMeta.length}`);

  let updated = 0;
  const BATCH = 500;
  for (let i = 0; i < works.length; i += BATCH) {
    const chunk = works.slice(i, i + BATCH);
    await db.$transaction(
      chunk.map((w) => {
        const needsFix = needSynopsis.includes(w);
        const syn = needsFix ? buildSynopsis(w) : (w.synopsisPT ?? "");
        const hue = hashStr(w.id) % 360;
        const data: Record<string, string> = {};
        if (needsFix) {
          data.synopsis = syn;
          data.synopsisPT = syn;
        }
        if (!w.siteUrl) {
          const kind = w.type === "anime" ? "anime" : "manga";
          data.siteUrl = `https://anilist.co/search/${kind}?search=${encodeURIComponent(w.title)}`;
        }
        if (!w.coverColor) data.coverColor = hslToHex(hue, 68, 44);
        if (!Object.keys(data).length) return db.work.updateMany({ where: { id: w.id }, data: {} });
        updated++;
        return db.work.update({ where: { id: w.id }, data });
      }),
    );
    if ((i / BATCH) % 10 === 0) console.log(`  lote ${i}/${works.length}...`);
  }
  console.log(`Sinopses/meta atualizadas: ${updated}`);

  // dedupe authors em TODAS as obras (reais incluídas)
  const all = await db.work.findMany({ select: { id: true, authors: true } });
  let fixedAuthors = 0;
  const fixBatch: { id: string; authors: string }[] = [];
  for (const w of all) {
    if (!w.authors) continue;
    try {
      const arr = JSON.parse(w.authors);
      if (!Array.isArray(arr) || arr.length < 2) continue;
      const seen = new Set<string>();
      const dedup = arr.filter((a: any) => {
        const k = String(a?.name ?? "").trim().toLowerCase();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      if (dedup.length !== arr.length) {
        fixBatch.push({ id: w.id, authors: JSON.stringify(dedup) });
      }
    } catch { /* ignora */ }
  }
  console.log(`Autores duplicados a corrigir: ${fixBatch.length}`);
  for (let i = 0; i < fixBatch.length; i += BATCH) {
    const chunk = fixBatch.slice(i, i + BATCH);
    await db.$transaction(
      chunk.map((f) => db.work.update({ where: { id: f.id }, data: { authors: f.authors } }))
    );
  }
  fixedAuthors = fixBatch.length;

  const t1 = Date.now();
  console.log(`Concluído em ${((t1 - t0) / 1000).toFixed(1)}s — sinopses/meta: ${updated}, autores dedup: ${fixedAuthors}`);
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
