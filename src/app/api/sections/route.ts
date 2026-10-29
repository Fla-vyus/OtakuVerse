// Seções da home — v4.0 (ETAPA 2): lê UM JSON pré-calculado (home_cache no Turso,
// escrito por /api/admin/refresh). Sem pool, sem computação por visita.
// Se a linha não existe (primeiro boot / banco novo), calcula na hora via SQL
// (fallback em src/lib/homecache.ts) e grava best-effort.
//
// CARREGAMENTO EM FASES (v3.5 — mantido):
//   ?part=core  → primeira dobra   |  ?part=more → resto (IntersectionObserver)
//   sem part    → tudo (compatibilidade)
// Cache HTTP: max-age 10 min + stale-while-revalidate 30 min — CDN/navegador
// absorvem o tráfego; o servidor só revalida.
import { NextRequest } from "next/server";
import { readHomeCache, writeHomeCache, buildHomeData, type HomeData } from "@/lib/homecache";
import { cachedJson, cachedVolatile } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __homeHot?: { at: number; data: HomeData } };
const HOT_TTL = 5 * 60_000; // cache quente pequeno (1 objeto) — evita 1 read por request

function emptyData(msg: string) {
  return {
    ok: false as const,
    error: msg,
    launches: [], newMangas: [], chapterReleases: [], hits: [], bestsellers: [],
    masterpieces: [], ecchiHits: [], manhwaHits: [], animePicks: [], monthLaunches: [],
    webnovelPicks: [], news: [], counts: { total: 0 },
  };
}

async function loadHome(): Promise<HomeData | null> {
  if (g.__homeHot && Date.now() - g.__homeHot.at < HOT_TTL) return g.__homeHot.data;
  const row = await readHomeCache();
  if (row) {
    g.__homeHot = { at: Date.now(), data: row };
    return row;
  }
  // fallback: computa via SQL e grava best-effort (próximas visitas leem o cache)
  try {
    const built = await buildHomeData();
    writeHomeCache(built).catch(() => {});
    g.__homeHot = { at: Date.now(), data: built };
    return built;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const part = req.nextUrl.searchParams.get("part"); // "core" | "more" | null (tudo)

  let data: HomeData | null = null;
  try {
    data = await loadHome();
  } catch { /* cai no soft-fail abaixo */ }

  if (!data) {
    return cachedVolatile(emptyData("Catálogo indisponível agora — tente novamente em instantes"));
  }

  if (part === "core") {
    const core = {
      launches: data.launches ?? [], newMangas: data.newMangas ?? [],
      chapterReleases: data.chapterReleases ?? [], news: data.news ?? [],
      counts: data.counts ?? { total: 0 },
    };
    return cachedJson({ ok: true, part: "core", ...core, cachedAt: data.at }, 600);
  }
  if (part === "more") {
    const more = {
      hits: data.hits ?? [], bestsellers: data.bestsellers ?? [],
      masterpieces: data.masterpieces ?? [], ecchiHits: data.ecchiHits ?? [],
      manhwaHits: data.manhwaHits ?? [], animePicks: data.animePicks ?? [],
      monthLaunches: data.monthLaunches ?? [], webnovelPicks: data.webnovelPicks ?? [],
    };
    return cachedJson({ ok: true, part: "more", ...more, cachedAt: data.at }, 600);
  }
  const { at, ...rest } = data;
  return cachedJson({ ok: true, ...rest, cachedAt: at }, 600);
}
