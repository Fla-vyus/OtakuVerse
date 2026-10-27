// Fonte REAL #6: MangaUpdates API (https://api.mangaupdates.com/v1) —
// banco editorial mais completo do mundo para mangás. Papel no OtakuVerse:
// enriquecimento editorial (ano, rank, gêneros, licenciamento) + TERCEIRA
// fonte de capas reais (images.mangaupdates.com) para a cadeia de fallback.
// Passa sempre pelo BROKER (fonte dedicada "mangaupdates").

import { brokerFetch } from "../broker";

const MU_API = "https://api.mangaupdates.com/v1";
const MU_UA = "OtakuVerse/1.0 (catalog portal; contact: otakuverse@proton.me)";

export interface MuRecord {
  series_id?: string | number;
  title?: string;
  url?: string;
  year?: string | null;
  description?: string | null;
  image?: { url?: { original?: string; thumb?: string } | null } | null;
  type?: string | null;
  status?: string | null;
  bayesian_rating?: string | null;
  rank?: { position?: string | null; year?: string | null } | null;
  genres?: { genre?: { genre?: string | null } | null }[] | null;
  category_recommendations?: unknown[];
}

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Busca no MangaUpdates (POST /series/search) através do broker */
export async function muSearch(title: string, perPage = 5): Promise<MuRecord[]> {
  const r = await brokerFetch("mangaupdates", `${MU_API}/series/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": MU_UA },
    body: JSON.stringify({ search: title.slice(0, 120), per_page: perPage, page: 1 }),
    timeoutMs: 18_000,
  });
  if (!r.data || !r.data.ok) return [];
  try {
    const json: any = await r.data.json();
    return json?.results?.map((x: any) => x.record).filter(Boolean) ?? [];
  } catch {
    return [];
  }
}

/** Encontra o melhor match por título normalizado */
export async function muMatch(title: string, titleEn?: string | null): Promise<MuRecord | null> {
  const targets = [title, titleEn].filter(Boolean) as string[];
  for (const t of targets) {
    const results = await muSearch(t, 5);
    const want = normTitle(t);
    if (!want) continue;
    const exact = results.find((r) => normTitle(r.title ?? "") === want);
    if (exact) return exact;
    const partial = results.find((r) => {
      const n = normTitle(r.title ?? "");
      return n.length > 3 && (n.includes(want) || want.includes(n));
    });
    if (partial) return partial;
  }
  return null;
}

/** URL da capa REAL do MangaUpdates (para a cadeia de fallback de imagens) */
export function muCover(r: MuRecord | null): string | null {
  const u = r?.image?.url?.original ?? r?.image?.url?.thumb ?? null;
  if (!u) return null;
  return u.startsWith("http") ? u : `https://www.mangaupdates.com${u}`;
}

export interface MuEnrich {
  cover: string | null;
  siteUrl: string | null;
  year: string | null;
  rating: number | null;
  rankPosition: number | null;
  genres: string[];
}

/** Enriquecimento editorial completo por título */
export async function muEnrich(title: string, titleEn?: string | null): Promise<MuEnrich | null> {
  const match = await muMatch(title, titleEn);
  if (!match) return null;
  const rating = match.bayesian_rating ? Number(match.bayesian_rating) : null;
  const rank = match.rank?.position ? parseInt(String(match.rank.position).replace(/[^0-9]/g, ""), 10) : null;
  return {
    cover: muCover(match),
    siteUrl: match.url ?? null,
    year: match.year ?? null,
    rating: Number.isFinite(rating) ? rating : null,
    rankPosition: Number.isFinite(rank) ? rank : null,
    genres: (match.genres ?? []).map((g) => g.genre?.genre ?? "").filter(Boolean),
  };
}
