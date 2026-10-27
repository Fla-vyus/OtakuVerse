/**
 * Seed MASSIVO do catálogo real (AniList) + enriquecimento multi-fonte:
 *  - Fase A: AniList em massa (milhares de obras reais com capa/banner)
 *  - Fase B: Kitsu → capas alternativas (coverAlt) para obras populares
 *  - Fase C: MangaUpdates → dados reais de revista/publicação para top mangás
 *  - Fase D: metadados editoriais derivados para o restante
 * Cada fonte faz seu papel — pedidos distribuídos, nenhum sobrecarregado.
 * Executar: bun scripts/seed-big.ts  (ou npx tsx scripts/seed-big.ts)
 */
import { PrismaClient } from "@prisma/client";
import { MAGAZINES, matchMagazine, deriveEditorial } from "../src/lib/magazines";

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
      console.log(`  tentativa ${attempt} falhou (${String(e.message).slice(0, 80)}), aguardando...`);
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

async function saveBatch(media: any[]): Promise<number> {
  let n = 0;
  for (const m of media) {
    if (!m?.id) continue;
    const row = toRow(m);
    try {
      await db.work.upsert({
        where: { id: row.id },
        create: row,
        update: { ...row, coverAlt: undefined, magazine: undefined },
      });
      n++;
    } catch (e: any) {
      console.error(`  erro ${row.title}: ${String(e.message).slice(0, 100)}`);
    }
  }
  return n;
}

// ---------------- Fase A: AniList em massa (retomável) ----------------
import { readFileSync, writeFileSync } from "node:fs";
const STATE_FILE = "/home/z/my-project/.seed-state.json";
function loadState(): { t: number; p: number } {
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf8"));
  } catch {
    return { t: 0, p: 1 };
  }
}
function saveState(t: number, p: number) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify({ t, p }));
  } catch {}
}

async function phaseAnilist() {
  console.log("═ FASE A: AniList em massa");
  const targets: { label: string; vars: Record<string, unknown>; pages: number }[] = [
    { label: "Mangás JP (populares)", vars: { type: "MANGA", country: "JP", sort: "POPULARITY_DESC" }, pages: 80 },
    { label: "Animes (populares)", vars: { type: "ANIME", country: "JP", sort: "POPULARITY_DESC" }, pages: 40 },
    { label: "Manhwas KR", vars: { type: "MANGA", country: "KR", sort: "POPULARITY_DESC" }, pages: 20 },
    { label: "Manhuas CN/TW", vars: { type: "MANGA", country: "CN", sort: "POPULARITY_DESC" }, pages: 10 },
    { label: "Light Novels", vars: { type: "MANGA", country: "JP", format: "NOVEL", sort: "POPULARITY_DESC" }, pages: 24 },
    { label: "Manhwas KR (nota)", vars: { type: "MANGA", country: "KR", sort: "SCORE_DESC" }, pages: 6 },
    { label: "Animes (tendência)", vars: { type: "ANIME", sort: "TRENDING_DESC" }, pages: 6 },
    { label: "Animes (nota)", vars: { type: "ANIME", sort: "SCORE_DESC" }, pages: 6 },
    { label: "Mangás JP (obras-primas)", vars: { type: "MANGA", country: "JP", sort: "SCORE_DESC" }, pages: 8 },
    { label: "Novos mangás JP (2024+)", vars: { type: "MANGA", country: "JP", sort: "START_DATE_DESC", startDate: 20240101 }, pages: 6 },
    { label: "Novos animes (2024+)", vars: { type: "ANIME", sort: "START_DATE_DESC", startDate: 20240101 }, pages: 6 },
    { label: "Novos manhwas (2023+)", vars: { type: "MANGA", country: "KR", sort: "START_DATE_DESC", startDate: 20230101 }, pages: 4 },
    { label: "Sensorial ecchi mangá", vars: { type: "MANGA", country: "JP", tag: ["Ecchi"], sort: "POPULARITY_DESC" }, pages: 8 },
    { label: "Animes em exibição", vars: { type: "ANIME", status: "RELEASING", sort: "TRENDING_DESC" }, pages: 3 },
  ];
  const QUERY = `
  query ($p: Int, $type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort], $tag: [String], $status: MediaStatus, $startDate: FuzzyDateInt) {
    Page(page: $p, perPage: 50) {
      media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort, tag_in: $tag, status: $status, startDate_greater: $startDate) {
        ${FIELDS}
      }
    }
  }`;

  const st = loadState();
  console.log(`  (retomando do alvo ${st.t}, página ${st.p})`);
  for (let ti = st.t; ti < targets.length; ti++) {
    const t = targets[ti];
    let got = 0;
    for (let p = ti === st.t ? st.p : 1; p <= t.pages; p++) {
      try {
        const vars: Record<string, unknown> = { ...t.vars, p };
        if (vars.startDate === undefined) delete vars.startDate;
        const data = await gql(QUERY, vars);
        const media: any[] = data?.Page?.media ?? [];
        if (!media.length) break;
        got += await saveBatch(media);
        if (media.length < 50) break;
      } catch (e: any) {
        console.error(`  ✗ ${t.label} p${p}: ${String(e.message).slice(0, 120)}`);
        break;
      }
      saveState(ti, p + 1);
      await sleep(1600);
    }
    console.log(`  ✓ ${t.label}: +${got}`);
    saveState(ti + 1, 1);
  }
  saveState(targets.length, 1);
}

// ---------------- Fase B: Kitsu — capas alternativas ----------------
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/ (the|a|no|wa) /g, " ").trim();

async function phaseKitsu() {
  console.log("═ FASE B: Kitsu (capas alternativas)");
  const works = await db.work.findMany({ select: { id: true, title: true, titleEn: true, coverAlt: true }, orderBy: { popularity: "desc" }, take: 600 });
  const byNorm = new Map<string, string>();
  for (const w of works) {
    byNorm.set(norm(w.title), w.id);
    if (w.titleEn) byNorm.set(norm(w.titleEn), w.id);
  }
  let matched = 0;
  for (const kind of ["anime", "manga"] as const) {
    for (let p = 1; p <= 12; p++) {
      try {
        const res = await fetch(`https://kitsu.io/api/edge/${kind}?page%5Blimit%5D=20&page%5Boffset%5D=${(p - 1) * 20}&sort=-userCount`, {
          headers: { Accept: "application/vnd.api+json" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) break;
        const j: any = await res.json();
        for (const item of j.data ?? []) {
          const titles: string[] = [
            item.attributes?.canonicalTitle ?? "",
            ...(item.attributes?.titles ?? {}),
            ...(item.attributes?.abbreviatedTitles ?? []),
          ].filter(Boolean);
          const poster = item.attributes?.posterImage?.original ?? item.attributes?.posterImage?.large ?? null;
          if (!poster) continue;
          for (const t of titles) {
            const id = byNorm.get(norm(t));
            if (id) {
              await db.work.update({ where: { id }, data: { coverAlt: poster } }).catch(() => {});
              matched++;
              break;
            }
          }
        }
      } catch {
        break;
      }
      await sleep(400);
    }
    console.log(`  ✓ kitsu ${kind}: ${matched} capas alternativas até agora`);
  }
}

// ---------------- Fase C: MangaUpdates — revistas reais ----------------
async function phaseMangaUpdates() {
  console.log("═ FASE C: MangaUpdates (revistas e publicação real)");
  const top = await db.work.findMany({
    where: { country: "JP", classification: { not: "adult" } },
    select: { id: true, title: true, titleEn: true },
    orderBy: { popularity: "desc" },
    take: 220,
  });
  let matched = 0;
  for (const w of top) {
    try {
      const res = await fetch("https://api.mangaupdates.com/v1/series/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ search: w.titleEn ?? w.title, exclude_hentai: true }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) continue;
      const j: any = await res.json();
      const hit = j?.results?.[0]?.record;
      if (!hit) continue;
      const hitTitle = String(hit.title ?? "").toLowerCase();
      const want = (w.titleEn ?? w.title).toLowerCase().slice(0, 14);
      if (!hitTitle.includes(want.slice(0, 10))) continue;

      const magName = hit.publication?.magazine?.name ?? null;
      const muImage = hit.image?.url?.original ?? hit.image?.url?.thumb ?? null;
      const data: any = { coverAlt: w.coverAlt ?? muImage ?? null };

      if (magName) {
        const known = MAGAZINES.find((m) => m.name.toLowerCase() === magName.toLowerCase());
        if (known) {
          data.magazine = JSON.stringify({
            name: known.name, publisher: known.publisher, demographic: known.demographic,
            schedule: known.schedule, accepts: known.accepts, famous: known.famous, source: "mangaupdates",
          });
        } else {
          const pub = hit.publication ?? {};
          data.magazine = JSON.stringify({
            name: magName,
            publisher: pub.publisher?.name ?? null,
            demographic: pub.type ?? null,
            schedule: pub.type === "Manga" ? "Semanal/mensal" : null,
            accepts: [], famous: [], source: "mangaupdates",
          });
        }
      }
      await db.work.update({ where: { id: w.id }, data });
      matched++;
    } catch {
      // segue o baile
    }
    await sleep(500);
  }
  console.log(`  ✓ mangaupdates: ${matched} obras enriquecidas`);
}

// ---------------- Fase D: metadados editoriais derivados ----------------
async function phaseEditorial() {
  console.log("═ FASE D: metadados editoriais derivados");
  const rows = await db.work.findMany({ where: { magazine: null, classification: { not: "adult" } }, take: 20000 });
  let n = 0;
  for (const w of rows) {
    const tags = (() => { try { return JSON.parse(w.tags ?? "[]"); } catch { return []; } })();
    const mag = matchMagazine(w.title, w.titleEn, w.country, tags, []) ?? deriveEditorial(w.country, tags, w.format);
    if (mag) {
      await db.work.update({
        where: { id: w.id },
        data: {
          magazine: JSON.stringify({
            name: mag.name, publisher: mag.publisher, demographic: mag.demographic,
            schedule: mag.schedule, accepts: mag.accepts, famous: mag.famous, source: "derivado",
          }),
        },
      });
      n++;
    }
  }
  console.log(`  ✓ editorial: ${n} obras com metadados de revista`);
}

async function main() {
  const t0 = Date.now();
  const before = await db.work.count();
  console.log(`★ Seed grande — obras antes: ${before}`);
  await phaseAnilist();
  await phaseKitsu();
  await phaseMangaUpdates();
  await phaseEditorial();
  const after = await db.work.count();
  const byClass = await db.work.groupBy({ by: ["classification"], _count: true });
  const byType = await db.work.groupBy({ by: ["type"], _count: true });
  console.log(`★ Concluído em ${Math.round((Date.now() - t0) / 60000)} min — total: ${after}`);
  console.log("  classificação:", byClass.map((b) => `${b.classification}:${b._count}`).join(" "));
  console.log("  tipos:", byType.map((b) => `${b.type}:${b._count}`).join(" "));
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
