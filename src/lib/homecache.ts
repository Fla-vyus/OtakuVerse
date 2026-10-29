// v4.0 — ETAPA 2: home PRÉ-CALCULADA. As seções da home são computadas UMA vez
// (por /api/admin/refresh, chamada manual ou cron externo) e salvas como UM JSON
// pequeno na tabela home_cache do Turso. A home lê SÓ esse JSON — zero estado em
// memória, zero tarefa em segundo plano, Cache-Control longo na borda.
//
// Fallback: se a linha não existir, /api/sections chama buildHomeData() aqui
// (SQL direto, ~10 queries de ≤90 linhas) e tenta gravar o cache best-effort.
import { db } from "@/lib/db";
import { selectCards, catalogSizeSql } from "@/lib/works-sql";
import { toCardWork, estimateChapterReleases } from "@/lib/works";
import { buildNews } from "@/lib/news";
import type { WorkData } from "@/lib/types";

const BOOK_TYPES = ["manga", "manhwa", "manhua"];

// ---------- dedupe de franquia (mesma régua do route antigo) ----------
function franquia(w: WorkData): string {
  const base = w.title.split(/[:(/]/)[0].toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return base.replace(/ (part|season|temporada|s)?\s*(i{1,3}|iv|vi{1,3}|xi{0,3}|\d+|r\d+)$/i, "").trim() || base;
}
function dedupeFranquia(list: WorkData[], max: number): WorkData[] {
  const seen = new Set<string>();
  const out: WorkData[] = [];
  for (const w of list) {
    const key = franquia(w);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}
function project(list: WorkData[]): WorkData[] {
  return list.map((w) => toCardWork(w));
}

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);

// ---------- FASE 1 (primeira dobra) ----------
async function computeCore(): Promise<Record<string, unknown>> {
  const d0 = daysAgo(120), t0 = today();
  const launches = dedupeFranquia(
    await selectCards(
      `"startDate" >= ? AND "startDate" <= ? AND "cover" != '' AND "popularity" >= 300 AND ${'"classification" != \'adult\' AND "type" != \'drama\''}`,
      [d0, t0], `"popularity" DESC`, 40
    ), 24);
  let newMangas = dedupeFranquia(
    await selectCards(
      `"type" = 'manga' AND "cover" != '' AND "startDate" >= ? AND "startDate" <= ? AND "classification" != 'adult' AND "type" != 'drama'`,
      [d0, t0], `"startDate" DESC`, 40
    ), 24);
  if (newMangas.length < 8) {
    newMangas = dedupeFranquia(
      await selectCards(
        `"type" = 'manga' AND "cover" != '' AND "startDate" >= ? AND "startDate" <= ? AND "classification" != 'adult' AND "type" != 'drama'`,
        [daysAgo(365), t0], `"startDate" DESC`, 40
      ), 24);
  }
  const chapterPool = await selectCards(
    `"type" IN ('manga','manhwa','manhua') AND "status" = 'RELEASING' AND "lastUpdate" IS NOT NULL AND "cover" != '' AND "classification" != 'adult' AND "type" != 'drama'`,
    [], `"popularity" DESC`, 90
  );
  const chapterReleases = estimateChapterReleases(chapterPool, 48);
  const news = await buildNews(chapterPool).catch(() => []);
  return {
    launches: project(launches),
    newMangas: project(newMangas),
    chapterReleases: chapterReleases.map((r) => ({ ...r, work: toCardWork(r.work) })),
    news,
    counts: { total: await catalogSizeSql(false) },
  };
}

// ---------- FASE 2 (abaixo da dobra) ----------
async function computeMore(): Promise<Record<string, unknown>> {
  const gate = `"classification" != 'adult' AND "type" != 'drama'`;
  const d540 = daysAgo(540);
  const now = Date.now();

  // Bombando: estreias recentes com tração OU poucos caps
  let hits = dedupeFranquia(
    await selectCards(
      `"status" = 'RELEASING' AND "type" IN ('manga','manhwa','manhua') AND ("chapters" <= 5 OR ("startDate" >= ? AND "popularity" >= 3000)) AND ${gate}`,
      [d540], `"popularity" DESC`, 40
    ), 24);
  if (hits.length < 10) {
    const extraIds = new Set(hits.map((h) => h.id));
    const extra = (await selectCards(
      `"status" = 'RELEASING' AND "type" IN ('manga','manhwa','manhua') AND ${gate}`,
      [], `"popularity" DESC`, 40
    )).filter((w) => !extraIds.has(w.id));
    hits = [...hits, ...extra].slice(0, 24);
  }

  const bestsellers = dedupeFranquia(
    await selectCards(`"favourites" IS NOT NULL AND ${gate}`, [], `"favourites" DESC`, 40), 24);
  const masterpieces = dedupeFranquia(
    await selectCards(`"avgScore" >= 80 AND "cover" != '' AND ${gate}`, [], `"avgScore" DESC`, 40), 24);

  // Ecchi DE VERDADE: gênero oficial ou Nudity rank >= 75
  const ecchiRows = await selectCards(
    `"classification" = 'suggestive' AND "cover" != '' AND ("genres" LIKE '%"Ecchi"%' OR EXISTS (SELECT 1 FROM json_each("tags") je WHERE json_extract(je.value,'$.name') = 'Nudity' AND json_extract(je.value,'$.rank') >= 75)) AND ${gate}`,
    [], `"favourites" DESC`, 40);
  const seenFranchise = new Set<string>();
  const ecchiHits: WorkData[] = [];
  for (const w of ecchiRows) {
    const key = franquia(w);
    if (seenFranchise.has(key)) continue;
    seenFranchise.add(key);
    ecchiHits.push(w);
    if (ecchiHits.length >= 24) break;
  }
  if (ecchiHits.length < 24) {
    const extra = await selectCards(
      `"classification" = 'suggestive' AND "cover" != '' AND ${gate}`,
      [], `"favourites" DESC`, 40);
    for (const w of extra) {
      if (ecchiHits.length >= 24) break;
      const key = franquia(w);
      if (seenFranchise.has(key)) continue;
      seenFranchise.add(key);
      ecchiHits.push(w);
    }
  }

  const manhwaHits = dedupeFranquia(
    await selectCards(`"type" = 'manhwa' AND "cover" != '' AND ${gate}`, [], `"popularity" DESC`, 40), 24);
  const animePicks = dedupeFranquia(
    await selectCards(`"type" = 'anime' AND "cover" != '' AND ${gate}`, [], `"favourites" DESC`, 40), 24);
  const monthKey = new Date(now).toISOString().slice(0, 7);
  const monthLaunches = dedupeFranquia(
    await selectCards(`"startDate" LIKE ? AND "cover" != '' AND ${gate}`, [`${monthKey}%`], `"popularity" DESC`, 20), 12);
  const webnovelPicks = dedupeFranquia(
    await selectCards(`"type" = 'webnovel' AND "cover" != '' AND ${gate}`, [], `"popularity" DESC`, 40), 24);

  return {
    hits: project(hits),
    bestsellers: project(bestsellers),
    masterpieces: project(masterpieces),
    ecchiHits: project(ecchiHits),
    manhwaHits: project(manhwaHits),
    animePicks: project(animePicks),
    monthLaunches: project(monthLaunches),
    webnovelPicks: project(webnovelPicks),
  };
}

// ---------- Leitura/gravação do cache (tabela home_cache) ----------
export type HomeData = Record<string, any>;

export async function readHomeCache(): Promise<HomeData | null> {
  try {
    const rows = await db.$queryRawUnsafe<{ json: string; at: number }[]>(
      `SELECT json, at FROM home_cache WHERE key = 'home'`
    );
    if (!Array.isArray(rows) || !rows.length) return null;
    return JSON.parse(String(rows[0].json));
  } catch {
    return null;
  }
}

export async function writeHomeCache(data: HomeData): Promise<boolean> {
  try {
    await db.$queryRawUnsafe(
      `INSERT INTO home_cache (key, json, at) VALUES ('home', ?, ?)
       ON CONFLICT(key) DO UPDATE SET json = excluded.json, at = excluded.at`,
      JSON.stringify(data), Date.now()
    );
    return true;
  } catch {
    return false;
  }
}

/** Computa core+more via SQL (sem pool). Usado pelo admin/refresh e como fallback. */
export async function buildHomeData(): Promise<HomeData> {
  const [core, more] = await Promise.all([computeCore(), computeMore()]);
  return { ...core, ...more, at: Date.now() };
}

/** Refresh completo: computa + grava. Nunca derruba nada (erros viram exceção para o chamador tratar). */
export async function refreshHomeCache(): Promise<{ ok: true; at: number }> {
  const data = await buildHomeData();
  const written = await writeHomeCache(data);
  if (!written) throw new Error("falha ao gravar home_cache no banco");
  return { ok: true, at: data.at };
}
