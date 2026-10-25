/**
 * Seed do banco de obras a partir da API GraphQL da AniList (dados reais).
 * Executar: bun scripts/seed-works.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const API = "https://graphql.anilist.co";

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

async function gql(query: string, variables: Record<string, unknown>): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20000),
      });
      const json: any = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
      return json.data;
    } catch (e: any) {
      console.error(`  tentativa ${attempt} falhou: ${e.message}`);
      if (attempt === 3) throw e;
      await sleep(4000);
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

const SECTIONS: { name: string; vars: Record<string, unknown> }[] = [
  { name: "Mangás mais populares (JP)", vars: { type: "MANGA", country: "JP", sort: "POPULARITY_DESC", perPage: 28 } },
  { name: "Manhwas mais populares (KR)", vars: { type: "MANGA", country: "KR", sort: "POPULARITY_DESC", perPage: 28 } },
  { name: "Manhuas (CN)", vars: { type: "MANGA", country: "CN", sort: "POPULARITY_DESC", perPage: 12 } },
  { name: "Light Novels", vars: { type: "MANGA", country: "JP", format: "NOVEL", sort: "POPULARITY_DESC", perPage: 20 } },
  { name: "Sensorial/ecchi de qualidade (mais favoritados)", vars: { type: "MANGA", tag: ["Nudity"], sort: "FAVOURITES_DESC", perPage: 26 } },
  { name: "Animes sensoriais em alta", vars: { type: "ANIME", tag: ["Nudity"], sort: "FAVOURITES_DESC", perPage: 14 } },
  { name: "Lançamentos recentes mangá", vars: { type: "MANGA", country: "JP", sort: "POPULARITY_DESC", perPage: 20, startDate: 20240601 } },
  { name: "Lançamentos recentes manhwa", vars: { type: "MANGA", country: "KR", sort: "POPULARITY_DESC", perPage: 16, startDate: 20240101 } },
  { name: "Animes em alta (tendência)", vars: { type: "ANIME", sort: "TRENDING_DESC", perPage: 20 } },
  { name: "Animes mais populares", vars: { type: "ANIME", sort: "POPULARITY_DESC", perPage: 18 } },
  { name: "Notas mais altas (obras-primas)", vars: { type: "MANGA", country: "JP", sort: "SCORE_DESC", perPage: 14 } },
];

const QUERY = `
query ($type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort], $tag: [String], $perPage: Int, $startDate: FuzzyDateInt) {
  Page(perPage: $perPage) {
    media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort, tag_in: $tag, isAdult: false, startDate_greater: $startDate) {
      ${FIELDS}
    }
  }
}`;

async function main() {
  const all = new Map<number, any>();
  for (const sec of SECTIONS) {
    console.log(`→ ${sec.name}...`);
    const vars: Record<string, unknown> = { ...sec.vars };
    if (!vars.startDate) delete vars.startDate;
    try {
      const data = await gql(QUERY, vars);
      const media: any[] = data?.Page?.media ?? [];
      for (const m of media) {
        if (!all.has(m.id)) all.set(m.id, m);
      }
      console.log(`  +${media.length} (total único ${all.size})`);
    } catch (e: any) {
      console.error(`  seção ignorada: ${e.message}`);
    }
    await sleep(2600);
  }

  let count = 0;
  for (const m of all.values()) {
    const authors = (m.staff?.edges ?? [])
      .map((e: any) => ({ name: e.node?.name?.full ?? "?", role: e.role ?? "" }))
      .filter((a: any) => a.name);
    const links = (m.externalLinks ?? [])
      .filter((l: any) => l.site && l.url)
      .map((l: any) => ({ site: l.site, url: l.url, language: l.language ?? null, type: l.type ?? null, color: l.color ?? null, icon: l.icon ?? null }));
    const synopsis = stripHtml(m.description);
    const startDate = iso(m.startDate);
    const endDate = iso(m.endDate);
    const next = m.nextAiringEpisode;

    try {
      await db.work.upsert({
        where: { id: String(m.id) },
        create: {
          id: String(m.id),
          malId: m.idMal ?? null,
          type: mapType(m),
          format: m.format ?? null,
          title: m.title?.romaji ?? m.title?.english ?? `#${m.id}`,
          titleEn: m.title?.english ?? null,
          titleNative: m.title?.native ?? null,
          synonyms: JSON.stringify(m.synonyms ?? []),
          synopsis,
          cover: m.coverImage?.extraLarge ?? m.coverImage?.large ?? "",
          coverColor: m.coverImage?.color ?? null,
          banner: m.bannerImage ?? null,
          status: m.status ?? null,
          chapters: m.chapters ?? null,
          volumes: m.volumes ?? null,
          episodes: m.episodes ?? null,
          duration: m.duration ?? null,
          startDate,
          endDate,
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
        },
        update: {
          type: mapType(m),
          format: m.format ?? null,
          status: m.status ?? null,
          chapters: m.chapters ?? null,
          avgScore: m.averageScore ?? null,
          popularity: m.popularity ?? null,
          favourites: m.favourites ?? null,
          lastUpdate: m.updatedAt ?? null,
          nextEpisodeAt: next ? new Date(next.airingAt * 1000).toISOString() : null,
          nextEpisodeNum: next?.episode ?? null,
        },
      });
      count++;
    } catch (e: any) {
      console.error(`  erro salvando ${m.title?.romaji}: ${e.message}`);
    }
  }
  console.log(`\n✔ Seed concluído: ${count} obras no banco.`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
