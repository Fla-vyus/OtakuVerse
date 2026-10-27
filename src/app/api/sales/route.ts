// Vendas reais de mangá — rankings públicos da Oricon (séries e volumes por ano)
// + acumulados históricos. Capas resolvidas contra o catálogo real do banco.
import { NextResponse } from "next/server";
import { getAllWorks } from "@/lib/works";
import { SERIES_BY_YEAR, VOLUMES_BY_YEAR, ALL_TIME, matchWork, SALES_YEARS } from "@/lib/sales";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __salesCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

export async function GET() {
  if (g.__salesCache && Date.now() - g.__salesCache.at < TTL) {
    return cachedJson({ ok: true, ...g.__salesCache.data, cached: true });
  }
  const pool = await getAllWorks();

  const resolve = (name: string, aliases?: string[]) => {
    const w = matchWork(name, aliases, pool);
    if (!w) return null;
    return { workId: w.id, cover: w.cover, coverColor: w.coverColor ?? null, title: w.title, type: w.type };
  };

  // séries por ano — do ano mais recente para o mais antigo, cópias desc
  const series = SERIES_BY_YEAR.map((s) => ({ ...s, ...(resolve(s.series, s.aliases) ?? {}) }))
    .filter((s) => s.workId)
    .sort((a, b) => b.year - a.year || b.copies - a.copies);

  // volumes por ano — mesma ordem
  const volumes = VOLUMES_BY_YEAR.map((v) => ({ ...v, ...(resolve(v.series, v.aliases) ?? {}) }))
    .filter((v) => v.workId)
    .sort((a, b) => b.year - a.year || b.copies - a.copies);

  // acumulados históricos
  const allTime = ALL_TIME.map((a) => ({ ...a, ...(resolve(a.series, a.aliases) ?? {}) }))
    .filter((a) => a.workId)
    .sort((a, b) => b.copies - a.copies);

  const data = {
    years: SALES_YEARS,
    series,
    volumes,
    allTime,
    source: "Rankings públicos da Oricon e acumulados divulgados por editoras — números aproximados; capas do catálogo real",
    updatedAt: new Date().toISOString(),
  };
  g.__salesCache = { at: Date.now(), data };
  return cachedJson({ ok: true, ...data });
}
