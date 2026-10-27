/**
 * Seed EXPANSÃO MASSIVA v4 — cobre o catálogo da AniList em profundidade via
 * particionamento recursivo por janelas de data com LIMITES EXPLÍCITOS.
 *
 * Descobertas (verify-dates2):
 *  - startDate_greater EXCLUI obras sem data; startDate_lesser sozinho as inclui.
 *    → Janelas com sdGreater explícito têm total REAL e zero poluição de nulls.
 *  - START_DATE (asc) pagina do mais antigo p/ o mais novo; cap de profundidade:
 *    page × perPage ≤ 5000 (100 páginas de 50).
 *  - O pull da página 1 já devolve pageInfo.total → probe e pull em 1 request.
 *
 * Estratégia: janela (sdGreater, sdLesser) → page 1 revela total; se ≥ 4900
 * (grampo/realmente funda), divide ao meio recursivamente; senão puxa tudo.
 * Obras SEM data entram via varreduras complementares (alfabética/nota/favoritos).
 *
 * - Resumível: scripts/seed-expand-progress.json
 * - Rate-limit aware: 2.1s entre requests + backoff em 429/5xx
 * Executar: setsid --fork bun scripts/seed-expand.ts < /dev/null > scripts/seed-expand.log 2>&1
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync, existsSync } from "fs";

const db = new PrismaClient();
const API = "https://graphql.anilist.co";
const PROGRESS_FILE = new URL("./seed-expand-progress.json", import.meta.url).pathname;
const PER_PAGE = 50;
const MAX_PAGE = 100;        // 100 × 50 = 5000 (teto de profundidade)
const DEEP_TOTAL = 4900;     // total ≥ isso → dividir janela
const DELAY_MS = 2100;       // ~28 req/min
const RATE_WAIT_MS = 45000;
const MIN_SPAN_DAYS = 120;   // menor janela antes de aceitar teto parcial
const TOP = 19400101, BOTTOM = 20300101; // limites do espaço coberto

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

const QUERY = `
query ($type: MediaType, $country: CountryCode, $sort: [MediaSort],
       $sdGreater: FuzzyDateInt, $sdLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage hasNextPage }
    media(type: $type, countryOfOrigin: $country, sort: $sort,
          startDate_greater: $sdGreater, startDate_lesser: $sdLesser, isAdult: false) {
      ${FIELDS}
    }
  }
}`;

type Front = { key: string; name: string; vars: Record<string, unknown> };

// Frentes por data (cobertura ~completa). Sem filtro de formato: JP traz mangá+LN+one-shot.
const DATE_FRONTS: Front[] = [
  { key: "jp", name: "Mangás JP (mangá + LN + one-shot)", vars: { type: "MANGA", country: "JP" } },
  { key: "kr", name: "Manhwas KR", vars: { type: "MANGA", country: "KR" } },
  { key: "cn", name: "Manhuas CN", vars: { type: "MANGA", country: "CN" } },
  { key: "tw", name: "Manhuas TW", vars: { type: "MANGA", country: "TW" } },
  { key: "anime", name: "Animes", vars: { type: "ANIME" } },
];

// Varreduras complementares (sem data — alcançam obras sem startDate + caudas):
// alfabética pega extremos opostos do alfabeto; nota/favoritos pegam obras ranqueadas.
const BONUS: (Front & { sort: string; pages: number })[] = [
  { key: "jp_alpha_a", name: "Mangás JP A→K (alfabética)", vars: { type: "MANGA", country: "JP" }, sort: "TITLE_ROMAJI", pages: 100 },
  { key: "jp_alpha_z", name: "Mangás JP K→Z (alfabética desc)", vars: { type: "MANGA", country: "JP" }, sort: "TITLE_ROMAJI_DESC", pages: 100 },
  { key: "jp_score", name: "Mangás JP por nota", vars: { type: "MANGA", country: "JP" }, sort: "SCORE_DESC", pages: 100 },
  { key: "jp_fav", name: "Mangás JP por favoritos", vars: { type: "MANGA", country: "JP" }, sort: "FAVOURITES_DESC", pages: 60 },
  { key: "kr_alpha_a", name: "Manhwas KR alfabética", vars: { type: "MANGA", country: "KR" }, sort: "TITLE_ROMAJI", pages: 100 },
  { key: "kr_alpha_z", name: "Manhwas KR alfabética desc", vars: { type: "MANGA", country: "KR" }, sort: "TITLE_ROMAJI_DESC", pages: 100 },
  { key: "kr_score", name: "Manhwas KR por nota", vars: { type: "MANGA", country: "KR" }, sort: "SCORE_DESC", pages: 60 },
  { key: "cn_alpha_a", name: "Manhuas CN alfabética", vars: { type: "MANGA", country: "CN" }, sort: "TITLE_ROMAJI", pages: 100 },
  { key: "cn_alpha_z", name: "Manhuas CN alfabética desc", vars: { type: "MANGA", country: "CN" }, sort: "TITLE_ROMAJI_DESC", pages: 100 },
  { key: "anime_trending", name: "Animes em alta", vars: { type: "ANIME" }, sort: "TRENDING_DESC", pages: 30 },
  { key: "anime_alpha_a", name: "Animes alfabética", vars: { type: "ANIME" }, sort: "TITLE_ROMAJI", pages: 100 },
  { key: "anime_alpha_z", name: "Animes alfabética desc", vars: { type: "ANIME" }, sort: "TITLE_ROMAJI_DESC", pages: 100 },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- progresso ----------
type Progress = {
  windows: Record<string, number>;  // key → páginas já salvas
  totals: Record<string, number>;   // key → total da página 1
  closed: string[];                 // janelas concluídas
  done: string[];                   // frentes concluídas
};
function loadProgress(): Progress {
  try {
    if (existsSync(PROGRESS_FILE)) {
      const raw = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      return { windows: raw.windows ?? {}, totals: raw.totals ?? {}, closed: raw.closed ?? [], done: raw.done ?? [] };
    }
  } catch { /* segue */ }
  return { windows: {}, totals: {}, closed: [], done: [] };
}
const progress = loadProgress();
let dirty = false;
setInterval(() => {
  if (!dirty) return;
  dirty = false;
  try { writeFileSync(PROGRESS_FILE, JSON.stringify(progress)); } catch { /* segue */ }
}, 2000).unref();
function markDirty() { dirty = true; }
function flush() { try { writeFileSync(PROGRESS_FILE, JSON.stringify(progress)); } catch { /* segue */ } }
process.on("SIGINT", () => { flush(); process.exit(0); });
process.on("SIGTERM", () => { flush(); process.exit(0); });

// ---------- GraphQL ----------
async function gql(vars: Record<string, unknown>, label: string): Promise<any> {
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: QUERY, variables: vars }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) {
        console.log(`  [${label}] HTTP ${res.status} — backoff ${RATE_WAIT_MS / 1000}s`);
        await sleep(RATE_WAIT_MS);
        continue;
      }
      const json: any = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
      return json.data.Page;
    } catch (e: any) {
      console.log(`  [${label}] tentativa ${attempt} falhou: ${String(e.message).slice(0, 120)}`);
      if (attempt >= 8) throw e;
      await sleep(5000 * attempt);
    }
  }
  throw new Error(`${label}: desistiu após 8 tentativas`);
}

// ---------- janelas de data ----------
const DAY = 86400000;
function windowKey(frontKey: string, g: number, l: number | null) { return `${frontKey}_${g}_${l ?? "x"}`; }
function fuzzyToTs(f: number): number { return Date.UTC(Math.floor(f / 10000), Math.floor((f % 10000) / 100) - 1, Math.max(1, f % 100)); }
function tsToFuzzy(ts: number): number {
  const d = new Date(ts);
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}
function midpoint(g: number, l: number): number {
  return tsToFuzzy(fuzzyToTs(g) + Math.floor((fuzzyToTs(l) - fuzzyToTs(g)) / 2 / DAY) * DAY);
}

/** Puxa UMA página (salvando os dados) e devolve { total, count }. g/l null = sem filtro de data. */
async function pullOne(g: number | null, l: number | null, sort: string[], page: number, front: Front, label: string): Promise<{ total: number; count: number }> {
  const t0 = Date.now();
  const pg = await gql({ ...front.vars, sort, sdGreater: g ?? undefined, sdLesser: l ?? undefined, page, perPage: PER_PAGE }, `${label} p${page}`);
  const media = pg.media ?? [];
  if (media.length > 0) await savePage(media.map(toRow));
  const spent = Date.now() - t0;
  if (spent < DELAY_MS) await sleep(DELAY_MS - spent);
  return { total: pg.pageInfo.total ?? 0, count: media.length };
}

/** Completa as páginas restantes de uma janela/corte já dimensionado. */
async function pullRemaining(key: string, g: number | null, l: number | null, sort: string[], pages: number, front: Front, label: string): Promise<void> {
  const from = progress.windows[key] ?? 0;
  for (let p = from + 1; p <= pages; p++) {
    const { count } = await pullOne(g, l, sort, p, front, `${label}:${key}`);
    progress.windows[key] = p;
    markDirty();
    if (count === 0) break;
  }
}

/** Cobertura recursiva de janela [g, l): page 1 revela o total; funda → divide. */
async function coverWindow(front: Front, g: number, l: number, depth = 0): Promise<void> {
  const key = windowKey(front.key, g, l);
  if (progress.closed.includes(key)) { console.log(`  ${key}: fechada ✔`); return; }

  let total = progress.totals[key];
  const pulled = progress.windows[key] ?? 0;
  if (total === undefined) {
    ({ total } = await pullOne(g, l, ["START_DATE"], 1, front, front.name));
    progress.totals[key] = total;
    progress.windows[key] = 1;
    markDirty();
    console.log(`  [${front.name}] ${key}: total=${total}${total >= DEEP_TOTAL ? " (funda)" : ""}`);
  }

  const spanDays = (fuzzyToTs(l) - fuzzyToTs(g)) / DAY;
  if (total >= DEEP_TOTAL && spanDays > MIN_SPAN_DAYS && depth < 7) {
    const mid = midpoint(g, l);
    await coverWindow(front, g, mid, depth + 1);
    await coverWindow(front, mid, l, depth + 1);
    if (!progress.closed.includes(key)) { progress.closed.push(key); markDirty(); }
    return;
  }
  const pages = total >= DEEP_TOTAL ? MAX_PAGE : Math.min(MAX_PAGE, Math.ceil(total / PER_PAGE));
  if (pulled < pages) {
    if (total >= DEEP_TOTAL) console.log(`  [${front.name}] ${key}: teto no mínimo (${spanDays.toFixed(0)}d) — ${pages} págs parciais`);
    await pullRemaining(key, g, l, ["START_DATE"], pages, front, front.name);
  }
  if (!progress.closed.includes(key)) { progress.closed.push(key); markDirty(); }
}

/** Varredura linear por ordenação alternativa (alfabética/nota/etc). */
async function linearSweep(b: Front & { sort: string; pages: number }): Promise<void> {
  const key = `${b.key}`;
  if (progress.closed.includes(key)) { console.log(`✔ ${b.name}: já completa`); return; }
  console.log(`\n── ${b.name} (${b.pages} págs, ${b.sort})`);
  // páginas não têm limite exato: puxa até esgotar (count=0) ou pages
  let page = (progress.windows[key] ?? 0) + 1;
  while (page <= b.pages) {
    const { count, total } = await pullOne(null, null, [b.sort], page, b, b.name);
    progress.windows[key] = page;
    markDirty();
    if (count === 0 || page * PER_PAGE >= total) break;
    page++;
  }
  if (!progress.closed.includes(key)) { progress.closed.push(key); markDirty(); }
  console.log(`✔ ${b.name}`);
}

// ---------- mapeamento / persistência ----------
function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const clean = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(i|b|em|strong|p|span|div)[^>]*>/gi, "")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&mdash;/g, "—")
    .replace(/\(Source:.*?\)/gis, "")
    .trim();
  return clean || null;
}
function iso(d: any): string | null {
  if (!d || !d.year) return null;
  return `${d.year}-${String(d.month ?? 1).padStart(2, "0")}-${String(d.day ?? 1).padStart(2, "0")}`;
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

// ---------- main ----------
async function main() {
  const started = Date.now();
  for (const front of DATE_FRONTS) {
    if (progress.done.includes(`date:${front.key}`)) { console.log(`✔ ${front.key}: frente já completa`); continue; }
    console.log(`\n═══════ FRENTE ${front.name} ═══════`);
    try {
      await coverWindow(front, TOP, BOTTOM);
      progress.done.push(`date:${front.key}`);
      flush();
      const c = await db.work.count();
      console.log(`✔ ${front.key}: concluída — banco: ${c}`);
    } catch (e: any) {
      console.error(`✖ ${front.key}: ${String(e.message).slice(0, 200)} — seguindo`);
    }
  }
  for (const b of BONUS) {
    try { await linearSweep(b); } catch (e: any) {
      console.error(`✖ ${b.key}: ${String(e.message).slice(0, 200)} — seguindo`);
    }
  }
  flush();
  const total = await db.work.count();
  const byType = await db.work.groupBy({ by: ["type"], _count: true });
  console.log(`\n✔ Expansão concluída em ${((Date.now() - started) / 60000).toFixed(1)} min — ${total} obras no banco.`);
  for (const g of byType) console.log(`   ${g.type}: ${g._count}`);
}

main()
  .catch((e) => { console.error("FATAL:", e); flush(); process.exit(1); })
  .finally(() => db.$disconnect());
