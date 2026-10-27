// Fonte REAL: Kitsu API (https://kitsu.io/api/edge) — complemento para o catálogo e
// segunda fonte de capas reais (media.kitsu.app). Títulos originais (en_jp = romaji/original).

import { brokerFetch } from "../broker";
import { MD_UA } from "./mangadex";

const KITSU = "https://kitsu.io/api/edge";

/** Passa pelo BROKER (fila própria + retry + breaker). Retorna null quando a fonte cai. */
export async function kitsuFetch(path: string, params: string): Promise<any> {
  const r = await brokerFetch("kitsu", `${KITSU}${path}?${params}`, {
    headers: { "User-Agent": MD_UA, Accept: "application/vnd.api+json" },
    timeoutMs: 25_000,
  });
  if (!r.data || !r.data.ok) return null;
  try {
    return await r.data.json();
  } catch {
    return null;
  }
}

function stripHtml(s: string | null | undefined): string | null {
  if (!s) return null;
  const clean = s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200);
  return clean || null;
}

const STATUS_MAP: Record<string, string> = {
  current: "RELEASING",
  finished: "FINISHED",
  tba: "NOT_YET_RELEASED",
  unreleased: "NOT_YET_RELEASED",
  upcoming: "NOT_YET_RELEASED",
};

export interface KitsuEntry {
  id: string;
  attributes: {
    canonicalTitle?: string;
    titles: Record<string, string>;
    abbreviatedTitles?: string[];
    subtype?: string;
    synopsis?: string;
    posterImage?: { original?: string; large?: string; medium?: string; small?: string };
    coverImage?: { original?: string; large?: string };
    chapterCount?: number | null;
    volumeCount?: number | null;
    episodeCount?: number | null;
    episodeLength?: number | null;
    status?: string;
    startDate?: string | null;
    endDate?: string | null;
    userCount?: number | null;
    averageRating?: string | null;
    popularityRank?: number | null;
  };
  relationships?: Record<string, any>;
}

/** Converte entrada Kitsu (manga ou anime) em linha Prisma (id kt-<id>) */
export function kitsuToWorkRow(e: KitsuEntry, kind: "manga" | "anime") {
  const a = e.attributes;
  const t = a.titles ?? {};
  // original: en_jp é o título romaji/original do Kitsu; nativo: ja_jp / ko_kr etc.
  const title = t.en_jp || t.en_us || t.en || a.canonicalTitle || t.ja_jp || `#${e.id}`;
  const titleNative = t.ja_jp && t.ja_jp !== title ? t.ja_jp : null;
  const titleEn = t.en && t.en !== title ? t.en : null;

  const sub = a.subtype ?? "";
  let type = kind === "anime" ? "anime" : "manga";
  if (kind === "manga") {
    if (sub === "manhwa") type = "manhwa";
    else if (sub === "manhua") type = "manhua";
    else if (sub === "novel") type = "lightnovel";
  }
  const country = type === "manhwa" ? "KR" : type === "manhua" ? "CN" : "JP";

  const cover =
    a.posterImage?.original ?? a.posterImage?.large ?? a.posterImage?.medium ?? "";
  const coverAlt = a.posterImage?.large ?? a.posterImage?.medium ?? null;

  const synonyms: string[] = [...(a.abbreviatedTitles ?? []).filter(Boolean)];
  if (a.canonicalTitle && a.canonicalTitle !== title && !synonyms.includes(a.canonicalTitle)) {
    synonyms.push(a.canonicalTitle);
  }

  const links: { site: string; url: string; type: string }[] = [
    { site: "Kitsu", url: `https://kitsu.app/${kind}/${e.id}`, type: "SOCIAL" },
    { site: "MyAnimeList", url: `https://myanimelist.net/${kind === "anime" ? "anime" : "manga"}.php?q=${encodeURIComponent(title)}`, type: "INFO" },
  ];

  const pop = a.userCount ?? 0;
  return {
    id: `kt-${e.id}`,
    malId: null as number | null,
    type,
    format: kind === "anime" ? (sub ? sub.toUpperCase() : "TV") : (sub || "MANGA").toUpperCase(),
    title,
    titleEn,
    titleNative,
    synonyms: JSON.stringify(synonyms.slice(0, 6)),
    synopsis: stripHtml(a.synopsis),
    cover,
    coverAlts: coverAlt ? JSON.stringify([coverAlt]) : null,
    coverColor: null,
    banner: a.coverImage?.original ?? a.coverImage?.large ?? null,
    status: STATUS_MAP[a.status ?? ""] ?? "FINISHED",
    chapters: a.chapterCount ?? null,
    volumes: a.volumeCount ?? null,
    episodes: a.episodeCount ?? null,
    duration: a.episodeLength ?? null,
    startDate: a.startDate ?? null,
    endDate: a.endDate ?? null,
    country,
    isAdult: false,
    spicy: 0,
    genres: JSON.stringify([]),
    tags: JSON.stringify([]),
    avgScore: a.averageRating ? Math.round(Number(a.averageRating)) : null,
    popularity: pop,
    favourites: null,
    authors: JSON.stringify([]),
    extLinks: JSON.stringify(links),
    source: "KITSU",
    siteUrl: `https://kitsu.app/${kind}/${e.id}`,
    magazine: null,
    serialization: null,
    langs: null,
    follows: null,
    lastUpdate: null,
    nextEpisodeAt: null,
    nextEpisodeNum: null,
  };
}
