// Seed do catálogo 100% REAL — OtakuVerse v5
// Fontes: AniList (manga/manhwa/LN/anime) · MangaDex (mangá/webtoon + idiomas reais)
//         Kitsu (complemento) · TVMaze (doramas reais) · MangaUpdates (revistas reais)
// Nada de imagens geradas: toda capa vem do CDN oficial da obra/fonte.

import { PrismaClient } from "@prisma/client";
import { anilistFetch, toWorkRow } from "../src/lib/anilist";
import { mdFetch, mdToWorkRow, sleep, MD_UA } from "../src/lib/sources/mangadex";
import { kitsuFetch, kitsuToWorkRow } from "../src/lib/sources/kitsu";
import { CURATED_DRAMAS, tvSearchShow, tvToWorkRow } from "../src/lib/sources/tvmaze";
import { magazineKeyForSerialization, FAMOUS_SERIALIZATION } from "../src/lib/magazines";

const prisma = new PrismaClient();
const log = (...a: any[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();

// ============================================================
// 1) ANILIST — catálogo base (mangás, manhwas, LNs, animes, +18)
// ============================================================
const AL_FIELDS = `
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

interface AlJob {
  name: string;
  type: "MANGA" | "ANIME";
  pages: number;
  country?: string;
  format?: string;
  adult?: boolean;
  genre?: string;
  tagIn?: string[];
  startGte?: number;
  sort?: string;
}

const AL_JOBS: AlJob[] = [
  { name: "manga-pop", type: "MANGA", pages: 60 },
  { name: "anime-pop", type: "ANIME", pages: 40 },
  { name: "manhwa", type: "MANGA", pages: 12, country: "KR" },
  { name: "manhua", type: "MANGA", pages: 6, country: "CN" },
  { name: "lightnovel", type: "MANGA", pages: 12, format: "NOVEL" },
  { name: "manga-trend", type: "MANGA", pages: 8, sort: "TRENDING_DESC" },
  { name: "anime-trend", type: "ANIME", pages: 6, sort: "TRENDING_DESC" },
  { name: "manga-new", type: "MANGA", pages: 12, startGte: 20250401 },
  { name: "anime-new", type: "ANIME", pages: 6, startGte: 20250801 },
  { name: "adult-manga", type: "MANGA", pages: 12, adult: true },
  { name: "adult-anime", type: "ANIME", pages: 2, adult: true },
  { name: "ecchi-manga", type: "MANGA", pages: 10, genre: "Ecchi" },
  { name: "ecchi-anime", type: "ANIME", pages: 4, genre: "Ecchi" },
  { name: "seinen-manga", type: "MANGA", pages: 8, tagIn: ["Seinen"] },
  { name: "shoujo-manga", type: "MANGA", pages: 8, tagIn: ["Shoujo"] },
  { name: "josei-manga", type: "MANGA", pages: 4, tagIn: ["Josei"] },
];

async function seedAniList() {
  log("== AniList: início ==");
  const existing = new Set((await prisma.work.findMany({ select: { id: true } })).map((r) => r.id));
  let added = 0, seen = 0;

  for (const job of AL_JOBS) {
    const sort = job.sort ?? "POPULARITY_DESC";
    // declarações dinâmicas: só variáveis realmente usadas (AniList rejeita variável não usada)
    const decls = [
      "$type: MediaType", "$page: Int", "$perPage: Int", "$sort: [MediaSort]",
      job.country ? "$country: CountryCode" : "",
      job.format ? "$format: MediaFormat" : "",
      job.adult !== undefined ? "$adult: Boolean" : "",
      job.genre ? "$genre: String" : "",
      job.tagIn ? "$tagIn: [String]" : "",
      job.startGte ? "$startGte: FuzzyDateInt" : "",
    ].filter(Boolean).join(", ");
    const args = [
      "type: $type", "sort: $sort",
      job.country ? "countryOfOrigin: $country" : "",
      job.format ? "format: $format" : "",
      job.adult !== undefined ? "isAdult: $adult" : "",
      job.genre ? "genre: $genre" : "",
      job.tagIn ? "tag_in: $tagIn" : "",
      job.startGte ? "startDate_greater: $startGte" : "",
    ].filter(Boolean).join(", ");
    const cleanQuery = `query (${decls}) {
      Page(page: $page, perPage: $perPage) {
        media(${args}) { ${AL_FIELDS} }
      }
    }`;

    for (let page = 1; page <= job.pages; page++) {
      const vars: any = { type: job.type, page, perPage: 50, sort: [sort] };
      if (job.country) vars.country = job.country;
      if (job.format) vars.format = job.format;
      if (job.adult !== undefined) vars.adult = job.adult;
      if (job.genre) vars.genre = job.genre;
      if (job.tagIn) vars.tagIn = job.tagIn;
      if (job.startGte) vars.startGte = job.startGte;

      let media: any[] | null = null;
      for (let attempt = 1; attempt <= 4; attempt++) {
        try {
          const data = await anilistFetch(cleanQuery, vars);
          media = data?.Page?.media ?? [];
          break;
        } catch (e: any) {
          const msg = String(e?.message ?? e);
          if (/rate limit|Too Many Requests/i.test(msg)) {
            log(`  ⏳ rate limit (${job.name} p${page}), aguardando 35s...`);
            await sleep(35000);
          } else if (attempt < 4) {
            await sleep(4000 * attempt);
          } else {
            log(`  ✗ ${job.name} p${page}: ${msg}`);
          }
        }
      }
      if (!media) continue;

      const rows = media.map((m: any) => {
        const row = toWorkRow(m);
        return { ...row, coverAlts: m.coverImage?.large && m.coverImage?.large !== row.cover ? JSON.stringify([m.coverImage.large]) : null };
      });
      seen += rows.length;

      for (const row of rows) {
        if (existing.has(row.id)) continue;
        existing.add(row.id);
        await prisma.work.create({ data: row }).catch(() => {});
        added++;
      }
      process.stdout.write(`  ${job.name} p${page}/${job.pages} (+${added})\r`);
      await sleep(2150); // ~27 req/min (limite 30)
    }
    log(`✓ ${job.name} concluído`);
  }
  log(`== AniList: ${added} novas obras (de ${seen} escaneadas) ==`);
  await prisma.syncMeta.upsert({
    where: { id: "anilist-bulk" },
    create: { id: "anilist-bulk", lastSync: Math.floor(Date.now() / 1000), added },
    update: { lastSync: Math.floor(Date.now() / 1000), added },
  });
}

// ============================================================
// 2) MANGADEX — catálogo massivo real + idiomas reais
// ============================================================
const MD_JOBS: { name: string; order: string; ratings: string[]; pages: number }[] = [
  { name: "md-pop", order: "followedCount", ratings: ["safe", "suggestive", "erotica"], pages: 60 },
  { name: "md-adult", order: "followedCount", ratings: ["pornographic"], pages: 24 },
  { name: "md-fresh", order: "latestUploadedChapter", ratings: ["safe", "suggestive"], pages: 8 },
];

async function seedMangaDex() {
  log("== MangaDex: início ==");
  let added = 0;
  const batch: any[] = [];

  for (const job of MD_JOBS) {
    for (let page = 0; page < job.pages; page++) {
      const params = new URLSearchParams();
      params.set("limit", "100");
      params.set("offset", String(page * 100));
      params.set(`order[${job.order}]`, "desc");
      params.append("includes[]", "cover_art");
      params.append("includes[]", "author");
      params.append("includes[]", "artist");
      for (const r of job.ratings) params.append("contentRating[]", r);
      params.set("hasAvailableChapters", "true");

      let data: any = null;
      try {
        data = await mdFetch("/manga", params);
      } catch (e: any) {
        log(`  ✗ ${job.name} p${page}: ${e.message}`);
        continue;
      }
      const list: any[] = data?.data ?? [];
      for (const m of list) {
        const row = mdToWorkRow(m);
        row.id = `md-${m.id}`;
        batch.push(row);
        added++;
      }
      process.stdout.write(`  ${job.name} p${page + 1}/${job.pages} (coletadas ${added})\r`);
      await sleep(420); // ~2,4 req/s (limite 5/s)
    }
    log(`✓ ${job.name} concluído`);
  }

  // dedupe por id antes de inserir
  const map = new Map(batch.map((r) => [r.id, r]));
  const existingIds = new Set((await prisma.work.findMany({ select: { id: true }, where: { id: { startsWith: "md-" } } })).map((r) => r.id));
  const rows = [...map.values()].filter((r) => !existingIds.has(r.id));
  log(`  inserindo ${rows.length} obras MangaDex novas...`);
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 400) {
    const chunk = rows.slice(i, i + 400);
    const res = await prisma.work.createMany({ data: chunk });
    inserted += res.count;
  }
  log(`== MangaDex: ${inserted} obras inseridas (${rows.length} coletadas) ==`);
  await prisma.syncMeta.upsert({
    where: { id: "mangadex" },
    create: { id: "mangadex", lastSync: Math.floor(Date.now() / 1000), added: inserted },
    update: { lastSync: Math.floor(Date.now() / 1000), added: inserted },
  });
}

// ============================================================
// 3) KITSU — complemento (novos títulos + segunda capa real)
// ============================================================
async function seedKitsu() {
  log("== Kitsu: início ==");
  let added = 0;
  const batch: any[] = [];
  const jobs = [
    { kind: "manga" as const, params: "sort=-userCount&page[limit]=20&page[offset]=", pages: 25 },
    { kind: "anime" as const, params: "sort=-userCount&page[limit]=20&page[offset]=", pages: 15 },
    { kind: "manga" as const, params: "filter[subtype]=manhwa&sort=-userCount&page[limit]=20&page[offset]=", pages: 12 },
    { kind: "manga" as const, params: "filter[subtype]=novel&sort=-userCount&page[limit]=20&page[offset]=", pages: 12 },
  ];
  for (const job of jobs) {
    for (let p = 0; p < job.pages; p++) {
      try {
        const data = await kitsuFetch(`/${job.kind}`, `${job.params}${p * 20}`);
        const list: any[] = data?.data ?? [];
        for (const e of list) batch.push(kitsuToWorkRow(e, job.kind));
      } catch (e: any) {
        log(`  ✗ kitsu ${job.kind} p${p}: ${e.message}`);
      }
      process.stdout.write(`  kitsu ${job.kind} p${p + 1}/${job.pages}\r`);
      await sleep(350);
    }
  }
  const map = new Map(batch.map((r) => [r.id, r]));
  const existingKt = new Set((await prisma.work.findMany({ select: { id: true }, where: { id: { startsWith: "kt-" } } })).map((r) => r.id));
  const rows = [...map.values()].filter((r) => !existingKt.has(r.id));
  for (let i = 0; i < rows.length; i += 300) {
    const res = await prisma.work.createMany({ data: rows.slice(i, i + 300) });
    added += res.count;
  }
  log(`== Kitsu: ${added} obras inseridas (${rows.length} coletadas) ==`);
}

// ============================================================
// 4) TVMAZE — doramas asiáticos REAIS
// ============================================================
async function seedTvmaze() {
  log("== TVMaze (doramas): início ==");
  const existing = new Set((await prisma.work.findMany({ where: { type: "drama" }, select: { id: true } })).map((r) => r.id));
  let added = 0, skipped = 0, missing = 0;
  for (const [i, d] of CURATED_DRAMAS.entries()) {
    const res = await tvSearchShow(d.name, d.country).catch(() => null);
    if (!res) { missing++; }
    else {
      const row = tvToWorkRow(res, d.country);
      if (existing.has(row.id) || !row.cover) { skipped++; }
      else {
        await prisma.work.create({ data: row }).catch(() => { skipped++; });
        if (!existing.has(row.id)) added++;
        existing.add(row.id);
      }
    }
    process.stdout.write(`  dorama ${i + 1}/${CURATED_DRAMAS.length} (+${added})\r`);
    await sleep(700); // TVMaze: 20 req/10s
  }
  log(`== TVMaze: ${added} doramas reais inseridos, ${missing} não encontrados, ${skipped} já existiam/sem capa ==`);
  await prisma.syncMeta.upsert({
    where: { id: "tvmaze" },
    create: { id: "tvmaze", lastSync: Math.floor(Date.now() / 1000), added },
    update: { lastSync: Math.floor(Date.now() / 1000), added },
  });
}

// ============================================================
// 5) CRUZAMENTO — capas alternativas reais + preenchimento
// ============================================================
async function crossMatch() {
  log("== Cruzamento de fontes: início ==");
  const all = await prisma.work.findMany({
    select: { id: true, title: true, titleEn: true, titleNative: true, type: true, cover: true, coverAlts: true, langs: true, chapters: true, lastUpdate: true, source: true },
  });

  // índices por título normalizado
  const anilistIdx = new Map<string, any>();
  const mdIdx = new Map<string, any>();
  const ktIdx = new Map<string, any>();
  for (const w of all) {
    const names = [w.title, w.titleEn, w.titleNative].filter((t): t is string => !!t).map(norm).filter((t) => t.length >= 3);
    const target = w.id.startsWith("md-") ? mdIdx : w.id.startsWith("kt-") ? ktIdx : anilistIdx;
    for (const n of names) if (!target.has(n)) target.set(n, w);
  }

  const altsFor = new Map<string, string[]>();
  const updates: { id: string; data: any }[] = [];
  const addAlt = (id: string, url: string | null) => {
    if (!url) return;
    if (/\b(picsum|placekitten|via\.placeholder|dummyimage)\b/.test(url)) return; // paranoia: só imagens reais
    const arr = altsFor.get(id) ?? [];
    if (!arr.includes(url)) arr.push(url);
    altsFor.set(id, arr);
  };

  let matched = 0;
  const matchedIds = new Set<string>();
  for (const [n, md] of mdIdx) {
    const al = anilistIdx.get(n);
    if (!al) continue;
    if (al.id === md.id) continue;
    matched++;
    matchedIds.add(al.id); matchedIds.add(md.id);
    addAlt(al.id, md.cover);
    addAlt(md.id, al.cover);
    // fill: idiomas reais do MangaDex p/ obra AniList
    if (md.langs && !al.langs) updates.push({ id: al.id, data: { langs: md.langs } });
    // fill: capítulos mais frescos do MangaDex
    if (al.chapters == null && md.chapters != null) updates.push({ id: al.id, data: { chapters: md.chapters } });
    // fill: capa faltante
    if (!al.cover && md.cover) updates.push({ id: al.id, data: { cover: md.cover } });
    if (!md.cover && al.cover) updates.push({ id: md.id, data: { cover: al.cover } });
    if (al.type === "manga" && md.type === "manhwa") updates.push({ id: al.id, data: { type: "manhwa" } });
  }
  for (const [n, kt] of ktIdx) {
    const al = anilistIdx.get(n);
    if (!al || al.id === kt.id) continue;
    matched++;
    matchedIds.add(al.id); matchedIds.add(kt.id);
    addAlt(al.id, kt.cover);
    addAlt(kt.id, al.cover);
    if (!al.cover && kt.cover) updates.push({ id: al.id, data: { cover: kt.cover } });
    if (!kt.cover && al.cover) updates.push({ id: kt.id, data: { cover: al.cover } });
  }
  // AniList ↔ AniList (mesma obra, nomes alternativos) não é preciso — fonte única.
  for (const w of all) {
    const explicit = altsFor.get(w.id);
    const current = w.coverAlts ? JSON.parse(w.coverAlts as string) : [];
    const merged = [...new Set([...(explicit ?? []), ...current])].filter((u) => u && u !== w.cover);
    if (merged.length && JSON.stringify(merged) !== JSON.stringify(current)) {
      updates.push({ id: w.id, data: { coverAlts: JSON.stringify(merged) } });
    }
  }

  const updMap = new Map<string, any>();
  for (const u of updates) updMap.set(u.id, { ...updMap.get(u.id), ...u.data });
  let applied = 0;
  for (const [id, data] of updMap) {
    await prisma.work.update({ where: { id }, data }).catch(() => {});
    applied++;
  }
  const noCover = all.filter((w) => !w.cover && !updMap.has(w.id)).length;
  log(`== Cruzamento: ${matched} pares casados, ${applied} atualizações aplicadas, ${noCover} obras ainda sem capa ==`);
}

/** Normaliza rótulos sensíveis com base em dados REAIS:
 *  - gênero Ecchi (real da AniList/MangaDex) → tag Ecchi + spicy 1 (para o filtro obrigatório funcionar)
 *  - isAdult real → garante tag "+18" para o escudo funcionar
 *  - MangaDex pornographic → garante tag "Hentai" */
async function normalizeTags() {
  log("== Normalização de tags sensíveis ==");
  const rows = await prisma.work.findMany({
    select: { id: true, genres: true, tags: true, isAdult: true, spicy: true, status: true, source: true },
  });
  let ecchi = 0, plus18 = 0, hentai = 0;
  for (const w of rows) {
    const genres: string[] = JSON.parse(w.genres || "[]");
    const tags: { name: string; rank: number }[] = JSON.parse(w.tags || "[]");
    const names = new Set(tags.map((t) => t.name));
    let changed = false;
    if (genres.includes("Ecchi") && !names.has("Ecchi")) {
      tags.push({ name: "Ecchi", rank: 78 });
      names.add("Ecchi");
      changed = true;
    }
    if (genres.includes("Ecchi") && w.spicy === 0 && !w.isAdult) {
      await prisma.work.update({ where: { id: w.id }, data: { spicy: 1 } }).catch(() => {});
      ecchi++;
    }
    if (w.isAdult && !names.has("+18")) {
      tags.push({ name: "+18", rank: 85 });
      names.add("+18");
      changed = true;
      plus18++;
    }
    if (w.isAdult && w.spicy === 2 && !names.has("Hentai")) {
      tags.push({ name: "Hentai", rank: 82 });
      names.add("Hentai");
      changed = true;
      hentai++;
    }
    if (changed) {
      await prisma.work.update({ where: { id: w.id }, data: { tags: JSON.stringify(tags) } }).catch(() => {});
    }
  }
  log(`== Normalização: spicy1/ecchi ${ecchi}, tag +18 em ${plus18}, tag Hentai em ${hentai} ==`);
}

// ============================================================
// 5.5) ESTATÍSTICAS REAIS do MangaDex (follows/rating por lote de 100)
// ============================================================
async function seedMdStats() {
  log("== MangaDex statistics: início ==");
  const rows = await prisma.work.findMany({
    where: { id: { startsWith: "md-" } },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const ids = rows.map((r) => r.id.slice(3));
  let updated = 0;
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const id of chunk) params.append("manga[]", id);
    try {
      const res = await fetch("https://api.mangadex.org/statistics/manga?" + params.toString(), {
        headers: { "User-Agent": MD_UA },
        signal: AbortSignal.timeout(25000),
      });
      if (res.ok) {
        const json: any = await res.json();
        const stats = json?.statistics ?? {};
        for (const [uuid, s] of Object.entries<any>(stats)) {
          const follows = Number(s?.follows ?? 0);
          const bayesian = Number(s?.rating?.bayesian ?? 0);
          if (follows > 0 || bayesian > 0) {
            await prisma.work.update({
              where: { id: `md-${uuid}` },
              data: { follows, popularity: follows, avgScore: bayesian > 0 ? Math.round(bayesian * 10) : null },
            }).catch(() => {});
            updated++;
          }
        }
      }
    } catch {
      // segue o baile
    }
    process.stdout.write(`  stats ${Math.min(i + 100, ids.length)}/${ids.length} (+${updated})\r`);
    await sleep(380);
  }
  log(`== MangaDex statistics: ${updated} obras com seguidores/notas reais ==`);
}

// ============================================================
// 6) REVISTAS REAIS — MangaUpdates (publications) + mapa editorial
// ============================================================
async function enrichMagazines() {
  log("== Revistas (MangaUpdates): início ==");
  const candidates = await prisma.work.findMany({
    where: { serialization: null, type: { in: ["manga", "manhwa", "manhua", "lightnovel"] }, isAdult: false, popularity: { gte: 25000 } },
    orderBy: { popularity: "desc" },
    take: 220,
    select: { id: true, title: true, titleEn: true },
  });
  let enriched = 0;

  const tryEnrich = async (w: any) => {
    const searchName = w.titleEn || w.title;
    const res = await fetch("https://api.mangaupdates.com/v1/series/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": MD_UA },
      body: JSON.stringify({ search: searchName, per_page: 3, type: ["Manga"] }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!res || !res.ok) return null;
    const json: any = await res.json();
    const wanted = norm(w.title);
    const results: any[] = json?.results ?? [];
    const hit = results.find((r) => {
      const t = norm(r?.record?.title ?? "");
      return t === wanted || t.startsWith(wanted) || wanted.startsWith(t);
    });
    if (!hit) return null;
    const sid = hit.record?.series_id;
    if (!sid) return null;
    await sleep(850);
    const detail = await fetch(`https://api.mangaupdates.com/v1/series/${sid}`, {
      headers: { "User-Agent": MD_UA },
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!detail || !detail.ok) return null;
    const dj: any = await detail.json();
    const pubName: string | null = dj?.publications?.[0]?.publication_name ?? null;
    if (!pubName) return null;
    return { pubName, related: dj?.related_series ?? [] };
  };

  for (const [i, w] of candidates.entries()) {
    // 1) mapa editorial de obras famosas (fato público)
    const famous = FAMOUS_SERIALIZATION[norm(w.title)] ?? null;
    if (famous) {
      await prisma.work.update({
        where: { id: w.id },
        data: { serialization: famous, magazine: magazineKeyForSerialization(famous) },
      }).catch(() => {});
      enriched++;
      continue;
    }
    // 2) MangaUpdates (publications reais)
    const got = await tryEnrich(w);
    if (got) {
      await prisma.work.update({
        where: { id: w.id },
        data: { serialization: got.pubName, magazine: magazineKeyForSerialization(got.pubName) },
      }).catch(() => {});
      enriched++;
    }
    if (i % 10 === 0) process.stdout.write(`  revista ${i + 1}/${candidates.length} (+${enriched})\r`);
    await sleep(850);
  }
  log(`== Revistas: ${enriched}/${candidates.length} obras com serialização real ==`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  const only = process.argv[2]; // permite rodar fases separadas
  const t0 = Date.now();
  try {
    if (!only || only === "anilist") await seedAniList();
    if (!only || only === "mangadex") await seedMangaDex();
    if (only === "mdstats") await seedMdStats();
    if (!only || only === "kitsu") await seedKitsu();
    if (!only || only === "tvmaze") await seedTvmaze();
    if (!only || only === "match") { await crossMatch(); await normalizeTags(); }
    if (!only || only === "magazines") await enrichMagazines();

    const total = await prisma.work.count();
    const noCover = await prisma.work.count({ where: { cover: "" } });
    const byType = await prisma.work.groupBy({ by: ["type"], _count: { _all: true } });
    const secs = Math.round((Date.now() - t0) / 1000);
    log(`===== RESUMO: ${total} obras reais · sem capa: ${noCover} · ${secs}s =====`);
    log("por tipo:", byType.map((t) => `${t.type}:${t._count._all}`).join(" · "));
  } finally {
    await prisma.$disconnect();
  }
}
main();
