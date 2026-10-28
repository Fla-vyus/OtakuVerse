// Backfill do catálogo: re-recupera obras perdidas na corrupção do SQLite.
// Varre páginas de popularidade + data por tipo no AniList e insere o que falta.
// Resumível via .backfill-state.json. Rate limit respeitado (2.2s).
import { PrismaClient } from "@prisma/client";
import fs from "fs";

const db = new PrismaClient();
const STATE_FILE = ".backfill-state.json";

const SEARCH_FIELDS = `
  id idMal type format title { romaji english native } synonyms
  description status chapters volumes episodes duration
  startDate { year month day } endDate { year month day }
  countryOfOrigin isAdult genres tags { name rank }
  averageScore popularity favourites
  staff { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
  nextAiringEpisode { airingAt episode }
  source siteUrl
`;

const TARGETS = [
  { type: "MANGA", country: "JP", format: null },
  { type: "MANGA", country: "KR", format: null },
  { type: "MANGA", country: "CN", format: null },
  { type: "MANGA", country: "TW", format: null },
  { type: "ANIME", country: "JP", format: null },
  { type: "MANGA", country: "JP", format: "NOVEL" },
];
const SORTS = ["POPULARITY_DESC", "START_DATE_DESC"];
const MAX_PAGES = 150; // por (alvo, ordenação)

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
  } catch {
    return {};
  }
}
function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}

let state = loadState();

async function anilistFetch(query, variables) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    if (res.status === 429) {
      const wait = Number(res.headers.get("retry-after") ?? 60);
      console.log(`  rate-limit, aguardando ${wait}s`);
      await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    // erros GraphQL NUNCA podem ser silenciosos (200 com errors = lista vazia sem explicação)
    if (j?.errors?.length) throw new Error(`GraphQL: ${j.errors[0]?.message ?? "erro desconhecido"}`);
    return j;
  }
  throw new Error("AniList indisponível após 3 tentativas");
}

function serializeDate(d) {
  if (!d || !d.year) return null;
  const m = String(d.month ?? 1).padStart(2, "0");
  const day = String(d.day ?? 1).padStart(2, "0");
  return `${d.year}-${m}-${day}`;
}

function toRow(m) {
  return {
    // id NUMÉRICO puro (padrão do site inteiro) — a v2.8 usava `anilist-${m.id}` e
    // criou 18.234 gêmeos duplicados de obras que já tinham id numérico
    id: String(m.id),
    malId: m.idMal ?? null,
    type:
      m.format === "NOVEL"
        ? "lightnovel"
        : m.type === "ANIME"
          ? "anime"
          : m.countryOfOrigin === "KR"
            ? "manhwa"
            : m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW"
              ? "manhua"
              : "manga",
    format: m.format ?? null,
    title: m.title?.romaji ?? m.title?.english ?? `Obra ${m.id}`,
    titleEn: m.title?.english ?? null,
    titleNative: m.title?.native ?? null,
    synonyms: JSON.stringify(m.synonyms ?? []),
    synopsis: m.description ?? null,
    cover: (m.coverImage?.extraLarge ?? m.coverImage?.large ?? "") || "",
    coverAlt: null,
    coverColor: m.coverImage?.color ?? null,
    banner: m.bannerImage ?? null,
    status: m.status ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    startDate: serializeDate(m.startDate),
    endDate: serializeDate(m.endDate),
    country: m.countryOfOrigin ?? null,
    isAdult: !!m.isAdult,
    genres: JSON.stringify(m.genres ?? []),
    tags: JSON.stringify(m.tags ?? []),
    avgScore: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    favourites: m.favourites ?? null,
    authors: JSON.stringify((m.staff?.edges ?? []).slice(0, 5).map((e) => ({ name: e.node?.name?.full, role: e.role }))),
    extLinks: JSON.stringify(m.externalLinks ?? []),
    magazine: null,
    siteUrl: m.siteUrl ?? null,
    lastUpdate: null,
    nextEpisodeAt: m.nextAiringEpisode?.airingAt ? new Date(m.nextAiringEpisode.airingAt * 1000).toISOString() : null,
    nextEpisodeNum: m.nextAiringEpisode?.episode ?? null,
  };
}

function classifyOf(m) {
  const tags = (m.tags ?? []).map((t) => ({ name: t.name, rank: t.rank ?? 0 }));
  if (m.isAdult || m.format === "DOUJIN" || tags.some((t) => /hentai|doujin/i.test(t.name))) {
    // spicy sincronizado desde o nascimento (camada sensorial: 0 livre · 1 ecchi · 2 adulto)
    return { classification: "adult", adultTags: JSON.stringify(["+18", "Adulto"]), spicy: 2 };
  }
  // gênero "Ecchi" ⇒ suggestive (mesma regra de src/lib/works.ts e fix-ecchi-genre.ts —
  // sem ela o backfill recriava obras ecchi como "safe" e elas sumiam do filtro)
  if ((m.genres ?? []).includes("Ecchi")) return { classification: "suggestive", adultTags: "[]", spicy: 1 };
  const has = (n) => tags.some((t) => t.name === n);
  if (has("Ecchi") || has("Nudity") || has("Sexual Content")) {
    return { classification: "suggestive", adultTags: "[]", spicy: 1 };
  }
  return { classification: "safe", adultTags: "[]", spicy: 0 };
}

async function main() {
  const have = new Set((await db.work.findMany({ select: { id: true } })).map((r) => String(r.id).replace(/^anilist-/, "")));
  console.log(`Obras no banco: ${have.size}`);

  let added = 0;
  // prioridade: primeiro TODOS os popularity (obras visíveis), depois os start_date (cauda)
  for (const sort of SORTS) {
    for (const t of TARGETS) {
      const key = `${t.type}-${t.country}-${t.format ?? "x"}-${sort}`;
      const startPage = (state[key] ?? 0) + 1;
      console.log(`>> ${key} página ${startPage}..${MAX_PAGES}`);
      let emptyStreak = 0;
      for (let p = startPage; p <= MAX_PAGES; p++) {
        let list = [];
        let raw = "";
        try {
          const q = await anilistFetch(
            `query ($p: Int, $type: MediaType, $country: CountryCode, $format: MediaFormat) {
              Page(page: $p, perPage: 50) {
                media(type: $type, countryOfOrigin: $country, format: $format, sort: ${sort}, isAdult: false) { ${SEARCH_FIELDS} }
              }
            }`,
            { p, type: t.type, country: t.country, format: t.format ?? undefined }
          );
          list = q?.data?.Page?.media ?? []; // envelope GraphQL: { data: { Page: { media } } }
          if (!list.length) raw = JSON.stringify(q).slice(0, 240);
        } catch (e) {
          const msg = String(e?.message ?? e);
          if (msg.includes("HTTP 400")) {
            // 400 = fim da lista OU throttle degradado — pausa este alvo (retomável)
            state[key] = p;
            saveState(state);
            console.log(`  ${key} p${p}: 400 — pausa alvo (retomável)`);
            break;
          }
          console.log(`  ${key} p${p}: ${msg} — salva estado e segue`);
          state[key] = p - 1;
          saveState(state);
          continue;
        }
        if (!list.length) {
          emptyStreak++;
          console.log(`  ${key} p${p}: página vazia (streak ${emptyStreak}) — resposta: ${raw}`);
          if (emptyStreak >= 2) break;
          continue;
        }
        emptyStreak = 0;
        const fresh = list.filter((m) => !have.has(String(m.id)));
        for (const m of fresh) {
          const row = toRow(m);
          const cls = classifyOf(m);
          try {
            await db.work.create({ data: { ...row, classification: cls.classification, adultTags: cls.adultTags, spicy: cls.spicy } });
            have.add(row.id);
            added++;
          } catch {}
        }
        state[key] = p;
        if (p % 5 === 0) saveState(state);
        await new Promise((r) => setTimeout(r, 3500));
      }
      saveState(state);
      console.log(`   ${key}: concluído até p${state[key]} (acumulado +${added})`);
    }
  }
  console.log(`BACKFILL FINALIZADO: +${added} obras`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
