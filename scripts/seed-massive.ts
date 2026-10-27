/**
 * Seed MASSIVO do catálogo a partir da AniList (dados reais).
 * Pagina por popularidade em 5 frentes até ~17-20k obras.
 * - Resumível: progresso em scripts/seed-progress.json
 * - Rate-limit aware: espaçamento + backoff em 429
 * Executar: bun scripts/seed-massive.ts
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";

const db = new PrismaClient();
const API = "https://graphql.anilist.co";
const PROGRESS_FILE = new URL("./seed-progress.json", import.meta.url).pathname;
const PER_PAGE = 50;
const DELAY_MS = 2100;      // ~28 req/min (limite AniList 30/min)
const RATE_WAIT_MS = 45000; // backoff em 429

const FIELDS = `
  id
  idMal
  type
  title { romaji english native }
  synonyms
  description
  coverImage { extraLarge large color }
  bannerImage
  format
  status
  chapters
  volumes
  episodes
  duration
  startDate { year month day }
  endDate { year month day }
  countryOfOrigin
  isAdult
  genres
  tags { name rank }
  averageScore
  popularity
  favourites
  source
  siteUrl
  updatedAt
  staff(perPage: 4) { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

const MANGA_GENRE_SWEEPS = ["Horror", "Mystery", "Thriller", "Sports", "Slice of Life", "Drama"];
const MANGA_TAG_SWEEPS = ["Yuri", "Boys' Love", "Cultivation", "Isekai", "Time Travel", "Villainess"];
const ANIME_GENRE_SWEEPS = ["Sports", "Horror", "Mystery", "Slice of Life", "Sci-Fi"];

const SECTIONS: {
  key: string;
  name: string;
  pages: number;
  vars: Record<string, unknown>;
}[] = [
  // Base por popularidade (teto AniList: 5000 entradas por combinação de query)
  { key: "mangaJP", name: "Mangás JP por popularidade", pages: 100, vars: { type: "MANGA", country: "JP", sort: "POPULARITY_DESC" } },
  { key: "anime", name: "Animes por popularidade", pages: 100, vars: { type: "ANIME", sort: "POPULARITY_DESC" } },
  { key: "manhwaKR", name: "Manhwas KR por popularidade", pages: 42, vars: { type: "MANGA", country: "KR", sort: "POPULARITY_DESC" } },
  { key: "novelJP", name: "Light novels JP", pages: 36, vars: { type: "MANGA", country: "JP", format: "NOVEL", sort: "POPULARITY_DESC" } },
  { key: "manhuaCN", name: "Manhuas CN", pages: 26, vars: { type: "MANGA", country: "CN", sort: "POPULARITY_DESC" } },
  // Ordenações alternativas (trazem obras fora do top de popularidade)
  { key: "mangaJP_fav", name: "Mangás JP por favoritos", pages: 60, vars: { type: "MANGA", country: "JP", sort: "FAVOURITES_DESC" } },
  { key: "mangaJP_score", name: "Mangás JP por nota", pages: 50, vars: { type: "MANGA", country: "JP", sort: "SCORE_DESC" } },
  // Varreduras por gênero — cauda profunda de cada nicho
  ...MANGA_GENRE_SWEEPS.map((g) => ({
    key: `manga_g_${g.toLowerCase().replace(/\s+/g, "")}`,
    name: `Mangá JP ${g} (cauda)`,
    pages: 18,
    vars: { type: "MANGA", country: "JP", genre: g, sort: "POPULARITY_DESC" },
  })),
  ...MANGA_TAG_SWEEPS.map((t) => ({
    key: `manga_t_${t.toLowerCase().replace(/\s+|'/g, "")}`,
    name: `Mangá tag ${t} (cauda)`,
    pages: 18,
    vars: { type: "MANGA", tag: t, sort: "POPULARITY_DESC" },
  })),
  ...ANIME_GENRE_SWEEPS.map((g) => ({
    key: `anime_g_${g.toLowerCase().replace(/\s+/g, "")}`,
    name: `Anime ${g} (cauda)`,
    pages: 12,
    vars: { type: "ANIME", genre: g, sort: "POPULARITY_DESC" },
  })),
];

const QUERY = `
query ($type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort], $genre: [String], $tag: [String], $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage hasNextPage }
    media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort, genre_in: $genre, tag_in: $tag, isAdult: false) {
      ${FIELDS}
    }
  }
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Progress = Record<string, number>;
function loadProgress(): Progress {
  try {
    if (existsSync(PROGRESS_FILE)) return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
  } catch { /* segue */ }
  return {};
}
function saveProgress(p: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p));
}

class PageDepthError extends Error {}

async function gqlPage(vars: Record<string, unknown>, label: string): Promise<any[]> {
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: QUERY, variables: vars }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status === 500 || res.status === 502) {
        console.log(`  [${label}] HTTP ${res.status} — aguardando ${RATE_WAIT_MS / 1000}s...`);
        await sleep(RATE_WAIT_MS);
        continue;
      }
      const json: any = await res.json();
      if (json.errors) {
        const msg = JSON.stringify(json.errors);
        if (msg.includes("exceeds maximum allowed") || msg.includes("depth")) throw new PageDepthError(msg.slice(0, 120));
        throw new Error(msg.slice(0, 200));
      }
      return json.data?.Page?.media ?? [];
    } catch (e: any) {
      if (e instanceof PageDepthError) throw e;
      console.log(`  [${label}] tentativa ${attempt} falhou: ${String(e.message).slice(0, 120)}`);
      if (attempt >= 6) throw e;
      await sleep(5000 * attempt);
    }
  }
  return [];
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const clean = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(i|b|em|strong|p|span|div)[^>]*>/gi, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/\(Source:.*?\)/gis, "")
    .trim();
  return clean || null;
}

function iso(d: any): string | null {
  if (!d || !d.year) return null;
  const m = d.month ?? 1, day = d.day ?? 1;
  return `${d.year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mapType(m: any): string {
  if (m.type === "ANIME") return "anime";
  if (m.format === "NOVEL") return "lightnovel";
  if (m.countryOfOrigin === "KR") return "manhwa";
  if (m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW") return "manhua";
  return "manga";
}

function toRow(m: any) {
  const authors = (m.staff?.edges ?? [])
    .map((e: any) => ({ name: e.node?.name?.full ?? "?", role: e.role ?? "" }))
    .filter((a: any) => a.name);
  const links = (m.externalLinks ?? [])
    .filter((l: any) => l.site && l.url)
    .map((l: any) => ({ site: l.site, url: l.url, language: l.language ?? null, type: l.type ?? null, color: l.color ?? null, icon: l.icon ?? null }));
  const next = m.nextAiringEpisode;
  return {
    id: String(m.id),
    malId: m.idMal ?? null,
    type: mapType(m),
    format: m.format ?? null,
    title: m.title?.romaji ?? m.title?.english ?? `#${m.id}`,
    titleEn: m.title?.english ?? null,
    titleNative: m.title?.native ?? null,
    synonyms: JSON.stringify(m.synonyms ?? []),
    synopsis: stripHtml(m.description),
    cover: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
    coverColor: m.coverImage?.color ?? null,
    banner: m.bannerImage ?? null,
    status: m.status ?? null,
    chapters: m.chapters ?? null,
    volumes: m.volumes ?? null,
    episodes: m.episodes ?? null,
    duration: m.duration ?? null,
    startDate: iso(m.startDate),
    endDate: iso(m.endDate),
    country: m.countryOfOrigin ?? null,
    isAdult: false,
    genres: JSON.stringify(m.genres ?? []),
    tags: JSON.stringify((m.tags ?? []).map((t: any) => ({ name: t.name, rank: t.rank }))),
    avgScore: m.averageScore ?? null,
    popularity: m.popularity ?? null,
    favourites: m.favourites ?? null,
    authors: JSON.stringify(authors),
    extLinks: JSON.stringify(links),
    source: m.source ?? null,
    siteUrl: m.siteUrl ?? null,
    lastUpdate: m.updatedAt ?? null,
    nextEpisodeAt: next ? new Date(next.airingAt * 1000).toISOString() : null,
    nextEpisodeNum: next?.episode ?? null,
  };
}

const UPDATE_FIELDS = [
  "type", "format", "status", "chapters", "volumes", "episodes", "duration",
  "startDate", "endDate", "avgScore", "popularity", "favourites",
  "lastUpdate", "nextEpisodeAt", "nextEpisodeNum",
] as const;

async function savePage(rows: any[]) {
  for (let i = 0; i < rows.length; i += 25) {
    const chunk = rows.slice(i, i + 25);
    await db.$transaction(
      chunk.map((row) =>
        db.work.upsert({
          where: { id: row.id },
          create: row,
          update: Object.fromEntries(UPDATE_FIELDS.map((f) => [f, row[f]])),
        })
      )
    );
  }
}

async function main() {
  const progress = loadProgress();
  const started = Date.now();

  for (const sec of SECTIONS) {
    const from = progress[sec.key] ?? 0;
    if (from >= sec.pages) {
      console.log(`✔ ${sec.key}: já completo (${sec.pages} páginas).`);
      continue;
    }
    console.log(`\n→ ${sec.name}: páginas ${from + 1}..${sec.pages}`);
    try {
      for (let page = from + 1; page <= sec.pages; page++) {
        const t0 = Date.now();
        const media = await gqlPage({ ...sec.vars, page, perPage: PER_PAGE }, `${sec.key} p${page}`);
        if (media.length === 0) {
          console.log(`  [${sec.key} p${page}] vazia — pulando`);
        } else {
          await savePage(media.map(toRow));
        }
        progress[sec.key] = page;
        saveProgress(progress);
        const dt = ((Date.now() - t0) / 1000).toFixed(1);
        process.stdout.write(`  p${page}: +${media.length} (${dt}s)\n`);
        const spent = Date.now() - t0;
        if (spent < DELAY_MS) await sleep(DELAY_MS - spent);
      }
    } catch (e: any) {
      if (e instanceof PageDepthError) {
        console.log(`  [${sec.key}] teto de profundidade da AniList — seção encerrada no estado salvo.`);
        continue;
      }
      console.error(`  [${sec.key}] erro fatal na seção: ${String(e.message).slice(0, 160)} — seguindo para a próxima.`);
      continue;
    }
  }

  const total = await db.work.count();
  const byType = await db.work.groupBy({ by: ["type"], _count: true });
  console.log(`\n✔ Seed concluído em ${((Date.now() - started) / 60000).toFixed(1)} min — ${total} obras no banco.`);
  for (const g of byType) console.log(`   ${g.type}: ${g._count}`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
