/**
 * Seed da ZONA ADULTA (+18): obras reais classificadas como adultas na AniList
 * (hentai/doujin/adulto). Ficam BLOQUEADAS no catálogo público e só aparecem
 * na Zona Adulta quando o usuário ativa o Modo +18 no perfil.
 * Executar: bun scripts/seed-adult.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const API = "https://graphql.anilist.co";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const FIELDS = `
  id idMal type
  title { romaji english native }
  synonyms description
  coverImage { extraLarge large color }
  bannerImage format status
  chapters volumes episodes
  startDate { year month day } endDate { year month day }
  countryOfOrigin isAdult genres
  tags { name rank }
  averageScore popularity favourites
  source siteUrl updatedAt
  staff(perPage: 4) { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
`;

async function gql(query: string, variables: Record<string, unknown>, tries = 4): Promise<any> {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(25000),
      });
      if (res.status === 429) {
        const retry = Number(res.headers.get("retry-after") ?? 5);
        await sleep(retry * 1000 + 500);
        continue;
      }
      const json: any = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
      return json.data;
    } catch (e) {
      if (attempt === tries) throw e;
      await sleep(5000);
    }
  }
}

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
  const m = d.month ?? 1, day = d.day ?? 1;
  return `${d.year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function mapType(m: any): string {
  if (m.type === "ANIME") return "anime";
  if (m.countryOfOrigin === "KR") return "manhwa";
  if (m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW") return "manhua";
  if (m.format === "NOVEL") return "lightnovel";
  return "manga";
}

function adultTagsOf(m: any): string[] {
  const tags = (m.tags ?? []).map((t: any) => String(t.name).toLowerCase());
  const at: string[] = [];
  if (m.format === "DOUJIN" || tags.some((t) => t.includes("doujin"))) at.push("Doujin");
  if (tags.some((t) => t.includes("hentai") || t.includes("sex"))) at.push("Hentai");
  if (!at.length) at.push("+18");
  at.push("Adulto");
  return [...new Set(at)];
}

const TARGETS: { label: string; vars: Record<string, unknown>; pages: number }[] = [
  { label: "Adultos populares (mangá JP)", vars: { type: "MANGA", country: "JP", sort: "POPULARITY_DESC" }, pages: 10 },
  { label: "Adultos por formato DOUJIN", vars: { type: "MANGA", country: "JP", format: "DOUJIN", sort: "POPULARITY_DESC" }, pages: 5 },
  { label: "Adultos manhwa", vars: { type: "MANGA", country: "KR", sort: "POPULARITY_DESC" }, pages: 3 },
];

const QUERY = `
query ($p: Int, $type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort]) {
  Page(page: $p, perPage: 50) {
    media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort, isAdult: true) { ${FIELDS} }
  }
}`;

async function main() {
  const t0 = Date.now();
  let total = 0;
  for (const t of TARGETS) {
    let got = 0;
    for (let p = 1; p <= t.pages; p++) {
      try {
        const data = await gql(QUERY, { ...t.vars, p });
        const media: any[] = data?.Page?.media ?? [];
        if (!media.length) break;
        for (const m of media) {
          if (!m?.id) continue;
          const authors = (m.staff?.edges ?? [])
            .map((e: any) => ({ name: e.node?.name?.full ?? "?", role: e.role ?? "" }))
            .filter((a: any) => a.name);
          const links = (m.externalLinks ?? [])
            .filter((l: any) => l.site && l.url)
            .map((l: any) => ({ site: l.site, url: l.url, language: l.language ?? null, type: l.type ?? null, color: l.color ?? null, icon: l.icon ?? null }));
          const row = {
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
            coverAlt: null as string | null,
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
            isAdult: true,
            classification: "adult",
            adultTags: JSON.stringify(adultTagsOf(m)),
            genres: JSON.stringify(m.genres ?? []),
            tags: JSON.stringify((m.tags ?? []).map((x: any) => ({ name: x.name, rank: x.rank }))),
            avgScore: m.averageScore ?? null,
            popularity: m.popularity ?? null,
            favourites: m.favourites ?? null,
            authors: JSON.stringify(authors),
            extLinks: JSON.stringify(links),
            magazine: JSON.stringify({ name: "Círculo doujin / editora adulta", publisher: null, demographic: "web", schedule: "Irregular", accepts: ["Adulto"], famous: [], source: "derivado" }),
            source: m.source ?? null,
            siteUrl: m.siteUrl ?? null,
            lastUpdate: m.updatedAt ?? null,
            nextEpisodeAt: null as string | null,
            nextEpisodeNum: null as number | null,
          };
          await db.work.upsert({ where: { id: row.id }, create: row, update: { ...row, coverAlt: undefined, magazine: undefined } });
          got++; total++;
        }
      } catch (e: any) {
        console.error(`  ✗ ${t.label} p${p}: ${String(e.message).slice(0, 100)}`);
        break;
      }
      await sleep(2100);
    }
    console.log(`  ✓ ${t.label}: +${got}`);
  }
  const count = await db.work.count({ where: { classification: "adult" } });
  console.log(`★ Zona adulta: ${count} obras em ${Math.round((Date.now() - t0) / 60000)} min (bloqueadas por padrão)`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
