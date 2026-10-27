/**
 * Expansão do catálogo: continua as páginas de popularidade além do seed-big
 * para atingir DEZENAS DE MILHARES de obras reais. Retomável.
 * Executar: npx tsx scripts/seed-more.ts
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
  chapters volumes episodes duration
  startDate { year month day } endDate { year month day }
  countryOfOrigin isAdult genres
  tags { name rank }
  averageScore popularity favourites
  source siteUrl updatedAt
  staff(perPage: 4) { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
  nextAiringEpisode { airingAt timeUntilAiring episode }
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
        console.log(`  429 — aguardando ${retry}s...`);
        await sleep(retry * 1000 + 500);
        continue;
      }
      const json: any = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
      return json.data;
    } catch (e: any) {
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
  if (m.format === "NOVEL") return "lightnovel";
  if (m.countryOfOrigin === "KR") return "manhwa";
  if (m.countryOfOrigin === "CN" || m.countryOfOrigin === "TW") return "manhua";
  return "manga";
}

function classify(m: any): { classification: string; adultTags: string } {
  if (m.isAdult) {
    const tags = (m.tags ?? []).map((t: any) => t.name.toLowerCase());
    const at: string[] = [];
    if (m.format === "DOUJIN" || tags.some((t) => t.includes("doujin"))) at.push("Doujin");
    if (tags.some((t) => t.includes("hentai") || t.includes("sex"))) at.push("Hentai");
    if (!at.length) at.push("+18");
    at.push("Adulto");
    return { classification: "adult", adultTags: JSON.stringify([...new Set(at)]) };
  }
  const tagRanks = new Map((m.tags ?? []).map((t: any) => [t.name, t.rank]));
  if ((tagRanks.get("Ecchi") ?? 0) >= 30 || (tagRanks.get("Nudity") ?? 0) >= 40 || (tagRanks.get("Succubus") ?? 0) >= 50) {
    return { classification: "suggestive", adultTags: "[]" };
  }
  return { classification: "safe", adultTags: "[]" };
}

function toRow(m: any) {
  const authors = (m.staff?.edges ?? [])
    .map((e: any) => ({ name: e.node?.name?.full ?? "?", role: e.role ?? "" }))
    .filter((a: any) => a.name);
  const links = (m.externalLinks ?? [])
    .filter((l: any) => l.site && l.url)
    .map((l: any) => ({ site: l.site, url: l.url, language: l.language ?? null, type: l.type ?? null, color: l.color ?? null, icon: l.icon ?? null }));
  const next = m.nextAiringEpisode;
  const cls = classify(m);
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
    isAdult: !!m.isAdult,
    classification: cls.classification,
    adultTags: cls.adultTags,
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

const QUERY = `
query ($p: Int, $type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort]) {
  Page(page: $p, perPage: 50) {
    media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort, isAdult: false) {
      ${FIELDS}
    }
  }
}`;

// [label, vars, pageFrom, pageTo]
const TARGETS: [string, Record<string, unknown>, number, number][] = [
  ["Mangás JP por data 1-100", { type: "MANGA", country: "JP", sort: "START_DATE_DESC" }, 1, 100],
  ["Animes JP por data 1-60", { type: "ANIME", country: "JP", sort: "START_DATE_DESC" }, 1, 60],
  ["Manhwas KR por data 1-30", { type: "MANGA", country: "KR", sort: "START_DATE_DESC" }, 1, 30],
  ["Light Novels por data 1-30", { type: "MANGA", country: "JP", format: "NOVEL", sort: "START_DATE_DESC" }, 1, 30],
  ["Animes KR/CN por data 1-20", { type: "ANIME", sort: "START_DATE_DESC" }, 61, 80],
];

import { readFileSync, writeFileSync } from "node:fs";
const STATE_FILE = "/home/z/my-project/.seed-more-state.json";
function loadState(): { t: number; p: number } {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { t: 0, p: 0 };
  }
}
function saveState(t: number, p: number) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ t, p }));
  } catch {}
}

async function main() {
  const t0 = Date.now();
  const st = loadState();
  console.log(`★ Expansão do catálogo (retomando alvo ${st.t}, página ${st.p})`);
  let total = 0;
  for (let ti = st.t; ti < TARGETS.length; ti++) {
    const [label, vars, from, to] = TARGETS[ti];
    let got = 0;
    for (let p = ti === st.t ? Math.max(from, st.p) : from; p <= to; p++) {
      try {
        const data = await gql(QUERY, { ...vars, p });
        const media: any[] = data?.Page?.media ?? [];
        if (!media.length) break;
        for (const m of media) {
          if (!m?.id) continue;
          const row = toRow(m);
          try {
            await db.work.upsert({
              where: { id: row.id },
              create: row,
              update: {
                type: row.type, format: row.format, status: row.status, chapters: row.chapters,
                avgScore: row.avgScore, popularity: row.popularity, favourites: row.favourites,
                lastUpdate: row.lastUpdate, nextEpisodeAt: row.nextEpisodeAt, nextEpisodeNum: row.nextEpisodeNum,
              },
            });
            got++;
          } catch {}
        }
        if (media.length < 50) break;
      } catch (e: any) {
        console.error(`  ✗ ${label} p${p}: ${String(e.message).slice(0, 100)}`);
        break;
      }
      saveState(ti, p + 1);
      await sleep(1500);
    }
    total += got;
    console.log(`  ✓ ${label}: +${got}`);
    saveState(ti + 1, 0);
  }
  const count = await db.work.count();
  console.log(`★ Concluído em ${Math.round((Date.now() - t0) / 60000)} min — total no catálogo: ${count}`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
