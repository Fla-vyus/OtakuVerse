// Servidor: cliente da API GraphQL da AniList (busca ao vivo / descobrir)
const API = "https://graphql.anilist.co";

export const SEARCH_FIELDS = `
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

export function mapType(m: any): string {
  if (m.type === "ANIME") return "anime";
  if (m.format === "NOVEL") return "lightnovel";
  if (m.countryOfOrigin === "KR") return "manhwa";
  if (m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW") return "manhua";
  return "manga";
}

/** Converte um media AniList em payload pronto para upsert */
export function toWorkRow(m: any) {
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
    coverAlt: null,
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
    isAdult: !!m.isAdult,
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

export async function anilistFetch(query: string, variables: Record<string, unknown>, opts?: { timeoutMs?: number; tries?: number }): Promise<any> {
  // Resiliência: a AniList dá 429 (rate limit) e 5xx/timeout ocasionais. Em vez de
  // falhar na 1ª tentativa (cron perdia a janela inteira, busca ao vivo ficava vazia),
  // tentamos até 3x com backoff crescente. 429 respeita o Retry-After quando enviado.
  const tries = opts?.tries ?? 3;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(opts?.timeoutMs ?? 20000),
        cache: "no-store",
      });
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        const wait = retryAfter > 0 ? retryAfter * 1000 : 1200 * attempt;
        throw Object.assign(new Error(`AniList ${res.status}`), { __retryable: true, __wait: wait });
      }
      const json: any = await res.json();
      if (json.errors) throw new Error(json.errors[0]?.message ?? "Erro AniList");
      return json.data;
    } catch (e: any) {
      const retryable = e?.__retryable || e?.name === "TimeoutError" || e?.name === "AbortError" || /fetch failed|network/i.test(String(e?.message));
      if (attempt < tries && retryable) {
        await new Promise((r) => setTimeout(r, e?.__wait ?? 1200 * attempt));
        continue;
      }
      throw e;
    }
  }
  throw new Error("AniList inacessível");
}

export async function searchAniList(q: string, opts?: { type?: "ANIME" | "MANGA"; perPage?: number }): Promise<any[]> {
  const withType = !!opts?.type;
  const data = await anilistFetch(
    withType
      ? `query ($q: String, $type: MediaType, $perPage: Int) {
          Page(perPage: $perPage) {
            media(search: $q, type: $type, isAdult: false, sort: SEARCH_MATCH) { ${SEARCH_FIELDS} }
          }
        }`
      : `query ($q: String, $perPage: Int) {
          Page(perPage: $perPage) {
            media(search: $q, isAdult: false, sort: SEARCH_MATCH) { ${SEARCH_FIELDS} }
          }
        }`,
    withType ? { q, type: opts!.type, perPage: opts?.perPage ?? 12 } : { q, perPage: opts?.perPage ?? 12 }
  );
  return data?.Page?.media ?? [];
}

export async function trendingAniList(perPage = 12): Promise<any[]> {
  const data = await anilistFetch(
    `query ($perPage: Int) {
      Page(perPage: $perPage) {
        media(type: ANIME, sort: TRENDING_DESC, isAdult: false) { ${SEARCH_FIELDS} }
      }
    }`,
    { perPage }
  );
  return data?.Page?.media ?? [];
}
