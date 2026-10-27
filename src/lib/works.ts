// Servidor: acesso ao banco de obras (cache em memória) + filtros + similaridade
import { db } from "@/lib/db";
import { parseWork, type WorkData, type Classification } from "@/lib/types";

// ---------- Cache em memória (evita reler 10k+ rows do SQLite a cada request) ----------
interface Cache {
  works: WorkData[];
  builtAt: number;
  maxUpdatedAt: number;
}

const g = globalThis as unknown as { __ovCache?: Cache };
const TTL = 120_000; // 2 min

async function buildCache(): Promise<Cache> {
  const agg = await db.work.aggregate({ _max: { createdAt: true } });
  const maxUpdatedAt = agg._max.createdAt?.getTime() ?? 0;
  const rows = await db.work.findMany();
  const works = rows.map(parseWork);
  return { works, builtAt: Date.now(), maxUpdatedAt };
}

/** Pool completo de obras — exclui SEMPRE conteúdo adulto do pool público.
 *  Conteúdo adulto só entra no pool quando `adult=true` (usuário com modo +18 ativo e rota da zona adulta). */
export async function getAllWorks(adult = false): Promise<WorkData[]> {
  let cache = g.__ovCache;
  if (!cache || Date.now() - cache.builtAt > TTL) {
    cache = await buildCache();
    g.__ovCache = cache;
  }
  return adult ? cache.works : cache.works.filter((w) => w.classification !== "adult");
}

/** Invalida o cache após seeds/cron */
export function invalidateWorksCache() {
  g.__ovCache = undefined;
}

export async function getWorkById(id: string, adult = false): Promise<WorkData | null> {
  const pool = await getAllWorks(adult);
  return pool.find((w) => w.id === id) ?? null;
}

// ---------- Classificação ----------
/** Deriva a classificação de conteúdo a partir dos dados da AniList */
export function classify(m: { isAdult?: boolean; format?: string | null; tags?: { name: string; rank: number }[]; genres?: string[] }): { classification: Classification; adultTags: string[] } {
  if (m.isAdult) {
    const tags = (m.tags ?? []).map((t) => t.name.toLowerCase());
    const adultTags: string[] = [];
    if (m.format === "DOUJIN" || tags.some((t) => t.includes("doujin"))) adultTags.push("Doujin");
    if (tags.some((t) => t.includes("hentai") || t.includes("sex"))) adultTags.push("Hentai");
    if (!adultTags.length) adultTags.push("+18");
    adultTags.push("Adulto");
    return { classification: "adult", adultTags: [...new Set(adultTags)] };
  }
  const tagRanks = new Map((m.tags ?? []).map((t) => [t.name, t.rank]));
  const ecchi = tagRanks.get("Ecchi") ?? 0;
  const nudity = tagRanks.get("Nudity") ?? 0;
  const sensual = tagRanks.get("Succubus") ?? 0;
  if (ecchi >= 30 || nudity >= 40 || sensual >= 50) return { classification: "suggestive", adultTags: [] };
  return { classification: "safe", adultTags: [] };
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
