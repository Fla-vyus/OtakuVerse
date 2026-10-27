// Fonte REAL: MangaDex API (https://api.mangadex.org) — catálogo massivo de mangás,
// manhwas e manhuas com capas reais, títulos alternativos oficiais, tags reais,
// classificação de conteúdo e idiomas de tradução REAIS.
// Nomes originais: usamos o título original (romaji/nativo) como principal — nunca traduzimos.

export const MD_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const MD_API = "https://api.mangadex.org";

import { brokerFetch } from "../broker";

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface MdManga {
  id: string;
  attributes: {
    title: Record<string, string>;
    altTitles: Record<string, string>[];
    description: Record<string, string>;
    tags: { id: string; attributes: { name: Record<string, string> } }[];
    status: string;
    contentRating: string;
    lastVolume: string | null;
    lastChapter: string | null;
    year: number | null;
    availableTranslatedLanguages: string[];
    updatedAt: string;
    links: Record<string, string> | null;
    follows?: number;
  };
  relationships: { id: string; type: string; attributes?: { fileName?: string; name?: string } }[];
}

export async function mdFetch(path: string, params: URLSearchParams): Promise<any> {
  const url = `${MD_API}${path}?${params.toString()}`;
  // BROKER: fila própria (máx. 1 req/1,15 s), retry + Retry-After, coalescing
  // de GETs idênticos e circuit breaker — fim do bloqueio do MangaDex.
  const r = await brokerFetch("mangadex", url, {
    headers: { "User-Agent": MD_UA, Accept: "application/json" },
    timeoutMs: 25_000,
  });
  if (!r.data) throw new Error(r.error ?? "MangaDex indisponível");
  if (!r.data.ok) throw new Error(`MangaDex ${r.data.status}`);
  return r.data.json();
}

const GENRE_MAP = new Set([
  "Action", "Adventure", "Comedy", "Drama", "Fantasy", "Horror", "Mystery",
  "Romance", "Sci-Fi", "Slice of Life", "Sports", "Supernatural", "Thriller", "Ecchi",
]);

function stripMd(s: string | undefined): string | null {
  if (!s) return null;
  const clean = s
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*|__|`/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/\(Source:[^)]*\)/gi, "")
    .trim()
    .slice(0, 1400);
  return clean || null;
}

function originOf(titleKeys: string[], originalLanguage?: string | null): { country: string; type: string; origLang: string } {
  const ol = (originalLanguage ?? "").toLowerCase();
  if (ol === "ko" || titleKeys.includes("ko-ro") || titleKeys.includes("ko")) return { country: "KR", type: "manhwa", origLang: "ko" };
  if (ol.startsWith("zh") || titleKeys.some((k) => k.startsWith("zh"))) return { country: "CN", type: "manhua", origLang: "zh" };
  return { country: "JP", type: "manga", origLang: "ja" };
}

const SPICY_BY_RATING: Record<string, { spicy: number; isAdult: boolean }> = {
  safe: { spicy: 0, isAdult: false },
  suggestive: { spicy: 1, isAdult: false },
  erotica: { spicy: 1, isAdult: true },
  pornographic: { spicy: 2, isAdult: true },
};

const STATUS_MAP: Record<string, string> = {
  ongoing: "RELEASING",
  completed: "FINISHED",
  hiatus: "HIATUS",
  cancelled: "CANCELLED",
  "on hiatus": "HIATUS",
  upcoming: "NOT_YET_RELEASED",
};

/** Converte uma obra MangaDex em linha Prisma (id md-<uuid>) */
export function mdToWorkRow(m: MdManga) {
  const a = m.attributes;
  const titleKeys = Object.keys(a.title);
  const { country, type, origLang } = originOf(titleKeys, (a as any).originalLanguage);

  // título original em ordem de preferência (romaji legível > script nativo > en)
  const origOrder = [`${origLang}-ro`, origLang, "en", ...titleKeys];
  let title = "";
  for (const k of origOrder) {
    if (a.title[k]) { title = a.title[k]; break; }
  }
  if (!title) title = Object.values(a.title)[0] ?? `#${m.id.slice(0, 8)}`;

  // nativo: script original (kanji/hangul/hanzi)
  const nativeOrder = [origLang, "ko", "ja", "zh-hans", "zh-hant", "zh-hk", "zh"];
  let titleNative: string | null = null;
  for (const k of nativeOrder) {
    if (a.title[k]) { titleNative = a.title[k]; break; }
  }
  if (!titleNative) {
    for (const alt of a.altTitles) {
      const key = Object.keys(alt)[0];
      if (key === origLang || key === "ja" || key === "ko" || key.startsWith("zh")) {
        titleNative = alt[key];
        break;
      }
    }
  }

  // inglês oficial
  let titleEn: string | null = a.title["en"] ?? null;
  if (!titleEn) {
    for (const alt of a.altTitles) if (alt["en"]) { titleEn = alt["en"]; break; }
  }
  if (titleEn === title) titleEn = null;
  if (titleNative === title) titleNative = null;

  // todos os outros nomes (reais, das fontes)
  const synonyms: string[] = [];
  for (const alt of a.altTitles) {
    for (const v of Object.values(alt)) {
      const t = v.trim();
      if (t && t !== title && t !== titleEn && t !== titleNative && !synonyms.includes(t)) synonyms.push(t);
    }
  }

  const desc = stripMd(a.description["en"] ?? Object.values(a.description)[0]);
  const coverRel = m.relationships.find((r) => r.type === "cover_art");
  const cover = coverRel?.attributes?.fileName
    ? `https://uploads.mangadex.org/covers/${m.id}/${coverRel.attributes.fileName}`
    : "";

  const authors: { name: string; role: string }[] = [];
  for (const r of m.relationships) {
    if ((r.type === "author" || r.type === "artist") && r.attributes?.name) {
      authors.push({ name: r.attributes.name, role: r.type === "author" ? "Story" : "Art" });
    }
  }

  const tags = a.tags.map((t, i) => ({
    name: t.attributes.name["en"] ?? Object.values(t.attributes.name)[0],
    rank: i < 5 ? Math.max(45, 80 - i * 6) : 35,
  }));
  // demografia editorial REAL (MangaDex publicationDemographic) como tag
  const demo = (a as any).publicationDemographic as string | null;
  if (demo && !tags.some((t) => t.name.toLowerCase() === demo.toLowerCase())) {
    const label = demo.charAt(0).toUpperCase() + demo.slice(1).toLowerCase();
    tags.push({ name: label, rank: 62 });
  }
  const genres = tags.map((t) => t.name).filter((n) => GENRE_MAP.has(n));

  const links = a.links ?? {};
  const extLinks: { site: string; url: string; language?: string | null; type?: string | null }[] = [];
  if (links.mal) extLinks.push({ site: "MyAnimeList", url: `https://myanimelist.net/manga/${links.mal}`, type: "INFO" });
  if (links.mu) extLinks.push({ site: "MangaUpdates", url: `https://www.mangaupdates.com/series.html?id=${links.mu}`, type: "INFO" });
  if (links.ap) extLinks.push({ site: "Anime-Planet", url: `https://www.anime-planet.com/manga/${links.ap}`, type: "INFO" });
  if (links.engtl) extLinks.push({ site: "Site oficial (EN)", url: links.engtl, type: "OFFICIAL" });
  if (links.raw) extLinks.push({ site: "Site oficial (JP/KR)", url: links.raw, type: "OFFICIAL" });
  extLinks.push({ site: "MangaDex", url: `https://mangadex.org/title/${m.id}`, type: "STREAMING", language: "MULTI" });

  const spicy = SPICY_BY_RATING[a.contentRating] ?? { spicy: 0, isAdult: false };
  const follows = a.follows ?? null;

  return {
    id: `md-${m.id}`,
    malId: links.mal ? Number(links.mal) : null,
    type,
    format: type === "manhwa" || type === "manhua" ? "LONG_STRIP" : "MANGA",
    title,
    titleEn,
    titleNative,
    synonyms: JSON.stringify(synonyms.slice(0, 10)),
    synopsis: desc,
    cover,
    coverAlts: null as string | null,
    coverColor: null as string | null,
    banner: null as string | null,
    status: STATUS_MAP[a.status] ?? a.status,
    chapters: a.lastChapter ? Number(a.lastChapter) : null,
    volumes: a.lastVolume ? Number(a.lastVolume) : null,
    episodes: null as number | null,
    duration: null as number | null,
    startDate: a.year ? `${a.year}-01-01` : null,
    endDate: null as string | null,
    country,
    isAdult: spicy.isAdult,
    classification: spicy.isAdult ? "adult" : spicy.spicy >= 1 ? "suggestive" : "safe",
    adultTags: JSON.stringify(spicy.isAdult ? ["+18", "Adulto"] : []),
    spicy: spicy.spicy,
    genres: JSON.stringify(genres),
    tags: JSON.stringify(tags),
    avgScore: null as number | null,
    popularity: follows ?? 0,
    favourites: null as number | null,
    authors: JSON.stringify(authors),
    extLinks: JSON.stringify(extLinks),
    source: "MANGADEX",
    siteUrl: `https://mangadex.org/title/${m.id}`,
    magazine: null as string | null,
    langs: JSON.stringify(a.availableTranslatedLanguages ?? []),
    follows,
    lastUpdate: Math.floor(new Date(a.updatedAt).getTime() / 1000) || null,
    nextEpisodeAt: null as string | null,
    nextEpisodeNum: null as number | null,
  };
}
