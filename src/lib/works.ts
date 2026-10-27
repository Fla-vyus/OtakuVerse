// Servidor: acesso ao banco de obras (cache em memória) + filtros + similaridade
import { db } from "@/lib/db";
import { parseWork, type WorkData, type Classification } from "@/lib/types";

// ---------- Cache em memória (evita reler 10k+ rows do SQLite a cada request) ----------
interface Cache {
  works: WorkData[];
  builtAt: number;
  maxUpdatedAt: number;
}

const g = globalThis as unknown as {
  __ovCache?: Cache;
  __ovCacheBuilding?: Promise<Cache>; // single-flight: N requisições concorrentes = 1 rebuild
  __ovCacheStale?: Cache; // último cache válido — emergência quando o banco falha
};
const TTL = 300_000; // 5 min — pool de 24k obras é caro de remontar; invalidado por seeds/cron

async function buildCache(): Promise<Cache> {
  const agg = await db.work.aggregate({ _max: { createdAt: true } });
  const maxUpdatedAt = agg._max.createdAt?.getTime() ?? 0;
  const rows = await db.work.findMany();
  const works = rows.map(parseWork);
  return { works, builtAt: Date.now(), maxUpdatedAt };
}

/** Rebuild com single-flight: se já há um build em andamento, todo mundo espera o MESMO promise
 *  (antes: N requisições concorrentes geravam N leituras de 24k rows — stampede que travava o SQLite). */
function rebuildCache(): Promise<Cache> {
  if (g.__ovCacheBuilding) return g.__ovCacheBuilding;
  const p = buildCache()
    .then((cache) => {
      g.__ovCache = cache;
      return cache;
    })
    .finally(() => {
      g.__ovCacheBuilding = undefined;
    });
  g.__ovCacheBuilding = p;
  return p;
}

/** Pool completo de obras — exclui SEMPRE conteúdo adulto e dramas do pool público.
 *  Conteúdo adulto só entra no pool quando `adult=true` (usuário com modo +18 ativo e rota da zona adulta).
 *  Dramas saíram do catálogo a pedido do usuário: seguem no banco como dados inativos
 *  (links antigos respondem "não encontrada" no pool público).
 *
 *  Estratégia anti-"site vazio":
 *  - Cache frio → rebuild (com single-flight).
 *  - Cache expirado → devolve o stale NA HORA e revalida em background (o usuário nunca espera o rebuild).
 *  - Erro no rebuild (SQLite ocupado pelo cron/backup) → se há stale, devolve stale; senão propaga para a rota tratar. */
export async function getAllWorks(adult = false): Promise<WorkData[]> {
  let cache = g.__ovCache;
  if (!cache) {
    cache = await rebuildCache();
  } else if (Date.now() - cache.builtAt > TTL) {
    // stale-while-revalidate: responde já com o stale; revalida em background
    rebuildCache().catch(() => {});
  }
  if (adult) return cache.works;
  return cache.works.filter((w) => w.classification !== "adult" && w.type !== "drama");
}

/** Invalida o cache após seeds/cron. Com stale-while-revalidate, a próxima leitura
 *  responde stale imediatamente e revalida em background — sem janela vazia. */
export function invalidateWorksCache() {
  const stale = g.__ovCache;
  g.__ovCache = undefined;
  g.__ovCacheStale = stale;
}

/** Pool de emergência: último cache válido conhecido (usado por rotas quando o banco falha). */
export function peekStaleCache(): Cache | undefined {
  return g.__ovCache ?? g.__ovCacheStale;
}

/** Projeção de card: remove os campos pesados que os cards nunca usam.
 *  synopsis ~70% do peso de um card; authors/extLinks/synonyms/banner fecham o resto;
 *  tags passa por trim (cards usam as 2 primeiras — mantemos 6 por segurança).
 *  O detalhe da obra continua carregando o objeto COMPLETO via /api/works/[id]. */
export function toCardWork(w: WorkData): WorkData {
  return {
    ...w,
    synopsis: null,
    synopsisPT: null,
    synonyms: [],
    authors: [],
    extLinks: [],
    banner: null,
    siteUrl: null,
    ptTags: undefined,
    tags: [...w.tags].sort((a, b) => b.rank - a.rank).slice(0, 6),
  };
}

export async function getWorkById(id: string, adult = false): Promise<WorkData | null> {
  const pool = await getAllWorks(adult);
  return pool.find((w) => w.id === id) ?? null;
}

// ---------- Classificação ----------
/** Deriva a classificação de conteúdo a partir dos dados da AniList.
 *  `adultTags` já vai serializado (coluna JSON do banco) e `spicy` é a camada
 *  sensorial (0 livre · 1 ecchi/suggestive · 2 adulto) usada pelos filtros. */
export function classify(m: { isAdult?: boolean; format?: string | null; tags?: { name: string; rank: number }[]; genres?: string[] }): { classification: Classification; adultTags: string; spicy: number } {
  if (m.isAdult) {
    const tags = (m.tags ?? []).map((t) => t.name.toLowerCase());
    const adultTags: string[] = [];
    if (m.format === "DOUJIN" || tags.some((t) => t.includes("doujin"))) adultTags.push("Doujin");
    if (tags.some((t) => t.includes("hentai") || t.includes("sex"))) adultTags.push("Hentai");
    if (!adultTags.length) adultTags.push("+18");
    adultTags.push("Adulto");
    return { classification: "adult", adultTags: JSON.stringify([...new Set(adultTags)]), spicy: 2 };
  }
  const tagRanks = new Map((m.tags ?? []).map((t) => [t.name, t.rank]));
  const ecchi = tagRanks.get("Ecchi") ?? 0;
  const nudity = tagRanks.get("Nudity") ?? 0;
  const sensual = tagRanks.get("Succubus") ?? 0;
  if (ecchi >= 30 || nudity >= 40 || sensual >= 50) return { classification: "suggestive", adultTags: "[]", spicy: 1 };
  return { classification: "safe", adultTags: "[]", spicy: 0 };
}

// ---------- Similaridade ----------
function tagScore(a: WorkData, b: WorkData): number {
  const bTags = new Map(b.tags.map((t) => [t.name, t.rank]));
  let s = 0;
  for (const t of a.tags) {
    const r2 = bTags.get(t.name);
    if (r2) s += (t.rank * r2) / 10000;
  }
  return s;
}

function genreScore(a: WorkData, b: WorkData): number {
  const bg = new Set(b.genres);
  return a.genres.filter((g) => bg.has(g)).length * 0.9;
}

export interface RelatedBundle {
  similar: WorkData[];
  also: WorkData[];
  byAuthor: { author: string; works: WorkData[] }[];
}

export function computeRelated(target: WorkData, pool: WorkData[]): RelatedBundle {
  const others = pool.filter((w) => w.id !== target.id);
  const scored = others.map((w) => {
    let s = tagScore(target, w) * 1.15 + genreScore(target, w);
    if (w.type === target.type) s += 0.4;
    if (w.country === target.country) s += 0.25;
    s += ((w.avgScore ?? 60) - 60) / 100;
    return { w, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const similar = scored.slice(0, 12).map((x) => x.w);
  const also = scored.slice(12, 24).map((x) => x.w);

  const authorNames = new Set(
    target.authors.map((a) => a.name).filter(Boolean)
  );
  const byAuthorMap = new Map<string, WorkData[]>();
  for (const a of authorNames) {
    const works = others.filter((w) => w.authors.some((x) => x.name === a));
    if (works.length > 0) {
      works.sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0));
      byAuthorMap.set(a, works);
    }
  }
  return { similar, also, byAuthor: [...byAuthorMap.entries()].map(([author, works]) => ({ author, works })) };
}

// ---------- Filtros ----------
export interface WorkFilters {
  type?: string;
  genre?: string;
  tag?: string;
  status?: string;
  lang?: string;
  classification?: string; // all | safe | suggestive (adult tratado à parte)
  mag?: string; // nome da revista/publicação
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
}

export function filterWorks(all: WorkData[], f: WorkFilters): { items: WorkData[]; total: number } {
  let list = [...all];
  if (f.type && f.type !== "all") list = list.filter((w) => w.type === f.type);
  if (f.genre && f.genre !== "all") list = list.filter((w) => w.genres.includes(f.genre!));
  if (f.tag && f.tag !== "all") list = list.filter((w) => w.tags.some((t) => t.name === f.tag));
  if (f.status && f.status !== "all") list = list.filter((w) => w.status === f.status);
  if (f.classification && f.classification !== "all") list = list.filter((w) => w.classification === f.classification);
  if (f.mag && f.mag !== "all") list = list.filter((w) => w.magazine?.name === f.mag);
  if (f.q) {
    const q = f.q.toLowerCase().trim();
    list = list.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.titleEn ?? "").toLowerCase().includes(q) ||
        (w.titleNative ?? "").toLowerCase().includes(q) ||
        (w.synonyms ?? []).some((s) => s.toLowerCase().includes(q)) ||
        w.authors.some((a) => a.name.toLowerCase().includes(q))
    );
  }
  if (f.lang && f.lang !== "all") {
    list = list.filter((w) => {
      const langs = quickLangs(w);
      return langs.includes(f.lang!);
    });
  }
  const sort = f.sort ?? "popular";
  list.sort((a, b) => {
    switch (sort) {
      case "score": return (b.avgScore ?? 0) - (a.avgScore ?? 0);
      case "favorites": return (b.favourites ?? 0) - (a.favourites ?? 0);
      case "new":
        return (b.startDate ?? "").localeCompare(a.startDate ?? "");
      case "chapters": return (b.chapters ?? 0) - (a.chapters ?? 0);
      case "title": return a.title.localeCompare(b.title);
      default: return (b.popularity ?? 0) - (a.popularity ?? 0);
    }
  });
  const page = Math.max(1, f.page ?? 1);
  const perPage = Math.min(120, Math.max(6, f.perPage ?? 24));
  const total = list.length;
  return { items: list.slice((page - 1) * perPage, page * perPage), total };
}

export function quickLangs(w: WorkData): string[] {
  const langs = new Set<string>();
  if (w.country === "JP") langs.add("JA");
  if (w.country === "KR") langs.add("KO");
  if (w.country === "CN" || w.country === "TW") langs.add("ZH");
  if ((w.popularity ?? 0) >= 100000) langs.add("EN");
  if ((w.popularity ?? 0) >= 200000 || w.type === "anime" || w.type === "drama") langs.add("PT-BR");
  return [...langs];
}

// ---------- Facets (cacheado junto com o pool) ----------
const gFacets = globalThis as unknown as { __ovFacets?: { genres: { name: string; count: number }[]; tags: { name: string; count: number }[]; magazines: { name: string; count: number }[]; at: number } };

export async function getFacets(adult = false) {
  const gF = gFacets.__ovFacets;
  if (gF && Date.now() - gF.at < TTL) return gF;
  const all = await getAllWorks(adult);
  const genreCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  const magCount = new Map<string, number>();
  for (const w of all) {
    for (const g of w.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    for (const t of w.tags) {
      if (t.rank >= 60) tagCount.set(t.name, (tagCount.get(t.name) ?? 0) + 1);
    }
    if (w.magazine?.name) magCount.set(w.magazine.name, (magCount.get(w.magazine.name) ?? 0) + 1);
  }
  const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([name, count]) => ({ name, count }));
  const magazines = [...magCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([name, count]) => ({ name, count }));
  const result = { genres, tags, magazines, at: Date.now() };
  gFacets.__ovFacets = result;
  return result;
}

// ---------- Catálogo para a IA (respeita gating) ----------
export async function catalogForAI(adult = false): Promise<WorkData[]> {
  const all = await getAllWorks(adult);
  return all;
}

// ---------- Rankings (métricas da comunidade) ----------
export type RankMetric = "popular" | "score" | "favorites" | "chapters";
export type AdultMode = "hide" | "show" | "only";

export async function getRanking(type: string, metric: RankMetric, adult: AdultMode, take = 24): Promise<WorkData[]> {
  let pool = await getAllWorks(adult !== "hide");
  if (adult === "only") pool = pool.filter((w) => w.classification === "adult");
  if (type !== "all") pool = pool.filter((w) => w.type === type);
  const by: Record<RankMetric, (a: WorkData, b: WorkData) => number> = {
    popular: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
    score: (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0),
    favorites: (a, b) => (b.favourites ?? 0) - (a.favourites ?? 0),
    chapters: (a, b) => (b.chapters ?? 0) - (a.chapters ?? 0),
  };
  pool.sort(by[metric] ?? by.popular);
  return pool.slice(0, Math.min(96, Math.max(1, take)));
}

// ---------- Para Você (motor de afinidade) ----------
import { scoreForYou, type TasteProfileLike, type ListEntryLike, type ForYouResult } from "@/lib/scoring";

export interface ForYouOpts {
  surprise?: boolean;
  page?: number;
  perPage?: number;
  adult?: AdultMode;
}

export async function forYouPage(
  taste: TasteProfileLike,
  favorites: string[],
  lists: Record<string, ListEntryLike>,
  opts: ForYouOpts = {}
): Promise<{ items: ForYouResult[]; total: number }> {
  const adult = opts.adult ?? "hide";
  const pool = await getAllWorks(adult !== "hide");
  const filtered = adult === "only" ? pool.filter((w) => w.classification === "adult") : pool;
  const byId = new Map(pool.map((w) => [w.id, w]));
  const favWorks = favorites.map((id) => byId.get(id)).filter((w): w is WorkData => !!w);
  const scored = filtered
    .map((w) => scoreForYou(w, taste, favWorks, lists, { excludeIds: new Set(favorites), surprise: !!opts.surprise }))
    .filter((r) => r.score > -50);
  scored.sort((a, b) => b.score - a.score);
  const page = Math.max(1, opts.page ?? 1);
  const perPage = Math.min(60, Math.max(6, opts.perPage ?? 18));
  return { items: scored.slice((page - 1) * perPage, page * perPage), total: scored.length };
}

// ---------- Lançamentos de capítulos (ritmo semanal estimado) ----------
export interface ChapterEstimate {
  work: WorkData;
  nextChapter: number | null; // null = AniList não contabiliza (mostra "novo capítulo")
  dateISO: string;
  weekday: string;
  stale: boolean; // última atualização antiga → ritmo só estimado
}

const WD_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const WD_SCHEDULE: [RegExp, number][] = [
  [/domingo/i, 0], [/segunda/i, 1], [/ter[çc]a/i, 2], [/quarta/i, 3], [/quinta/i, 4], [/sexta/i, 5], [/s[áa]bado/i, 6],
];

/** Séries em lançamento (mangá/manhwa/manhua) com próximo capítulo estimado.
 *  Dia da semana: usa o calendário real da revista quando conhecido (ex.: "Semanal (quinta)");
 *  nas demais, distribuição estável e explícitamente rotulada como estimativa. */
export function estimateChapterReleases(pool: WorkData[], limit = 48): ChapterEstimate[] {
  const now = Date.now();
  const picked = pool
    .filter(
      (w) =>
        (w.type === "manga" || w.type === "manhwa" || w.type === "manhua") &&
        w.status === "RELEASING" &&
        !!w.lastUpdate &&
        !!w.cover
    )
    .map((w) => ({ w, fresh: now - w.lastUpdate! * 1000 < 60 * 86400000 }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || (b.w.popularity ?? 0) - (a.w.popularity ?? 0))
    .slice(0, limit);

  let rr = 0;
  return picked.map(({ w }) => {
    let day: number | null = null;
    const sched = w.magazine?.schedule ?? "";
    for (const [re, d] of WD_SCHEDULE) {
      if (re.test(sched)) { day = d; break; }
    }
    if (day == null) day = rr++ % 7; // distribuição estável (estimativa rotulada)
    const next = new Date(now);
    const delta = (day - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    return {
      work: w,
      nextChapter: w.chapters != null && w.chapters > 0 ? w.chapters + 1 : null,
      dateISO: next.toISOString().slice(0, 10),
      weekday: WD_PT[next.getDay()],
      stale: now - w.lastUpdate! * 1000 > 21 * 86400000,
    };
  });
}
