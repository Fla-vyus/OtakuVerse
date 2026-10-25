// Servidor: acesso ao banco de obras + cálculo de similaridade
import { db } from "@/lib/db";
import { parseWork, type WorkData } from "@/lib/types";

export async function getAllWorks(): Promise<WorkData[]> {
  const rows = await db.work.findMany();
  return rows.map(parseWork);
}

export async function getWorkById(id: string): Promise<WorkData | null> {
  const row = await db.work.findUnique({ where: { id } });
  return row ? parseWork(row) : null;
}

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
    // normaliza levemente por qualidade para desempate
    s += ((w.avgScore ?? 60) - 60) / 100;
    return { w, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const similar = scored.slice(0, 12).map((x) => x.w);
  const also = scored.slice(12, 24).map((x) => x.w);

  const authorNames = new Set(
    target.authors
      .map((a) => a.name)
      .filter(Boolean)
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

export interface WorkFilters {
  type?: string;
  genre?: string;
  tag?: string;
  status?: string;
  lang?: string;
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
    // filtro simples: PT-BR/EN via heurística de idiomas
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
  const page = f.page ?? 1;
  const perPage = f.perPage ?? 24;
  const total = list.length;
  return { items: list.slice((page - 1) * perPage, page * perPage), total };
}

export function quickLangs(w: WorkData): string[] {
  const langs = new Set<string>();
  if (w.country === "JP") langs.add("JA");
  if (w.country === "KR") langs.add("KO");
  if (w.country === "CN" || w.country === "TW") langs.add("ZH");
  if ((w.popularity ?? 0) >= 100000) langs.add("EN");
  if ((w.popularity ?? 0) >= 200000 || w.type === "anime") langs.add("PT-BR");
  return [...langs];
}

export function getFacets(all: WorkData[]) {
  const genreCount = new Map<string, number>();
  const tagCount = new Map<string, number>();
  for (const w of all) {
    for (const g of w.genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    for (const t of w.tags) {
      if (t.rank >= 60) tagCount.set(t.name, (tagCount.get(t.name) ?? 0) + 1);
    }
  }
  const genres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 80).map(([name, count]) => ({ name, count }));
  return { genres, tags };
}
