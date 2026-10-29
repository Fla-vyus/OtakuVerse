// Vendas reais de mangá — rankings públicos da Oricon (séries e volumes por ano)
// + acumulados históricos. Capas resolvidas contra o catálogo real do banco.
// v4.0: resolução dos nomes por UMA query SQL (OR-chain de prefixos sobre título/
// titleEn/titleNative + synonyms) em vez do pool em memória.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { PUBLIC_GATE } from "@/lib/works-sql";
import { SERIES_BY_YEAR, VOLUMES_BY_YEAR, ALL_TIME, matchWork, SALES_YEARS } from "@/lib/sales";
import { cachedJson } from "@/lib/httpCache";
import type { WorkData } from "@/lib/types";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __salesCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

function esc(s: string): string {
  return s.replace(/['"\\%_]/g, " ").trim();
}

/** Busca os candidatos das séries Oricon — em chunks (SQLite limita a profundidade
 *  da árvore de expressão; OR-chain de 880 termos estoura "maximum depth 100"). */
async function salesPool(): Promise<WorkData[]> {
  const entries: { name: string; aliases?: string[] }[] = [
    ...SERIES_BY_YEAR.map((s) => ({ name: s.series, aliases: s.aliases })),
    ...VOLUMES_BY_YEAR.map((v) => ({ name: v.series, aliases: v.aliases })),
    ...ALL_TIME.map((a) => ({ name: a.series, aliases: a.aliases })),
  ];
  const names = [...new Set(entries.flatMap((e) => [e.name, ...(e.aliases ?? [])]))]
    .map(esc)
    .filter((n) => n.length >= 3)
    .slice(0, 220);
  const out = new Map<string, WorkData>();
  const CHUNK = 20; // 20 nomes × 4 colunas = 80 ORs por query (sob o limite)
  for (let i = 0; i < names.length; i += CHUNK) {
    const chunk = names.slice(i, i + CHUNK);
    const likes = chunk.flatMap((n) => [
      `lower("title") LIKE '${n.toLowerCase()}%'`,
      `lower(COALESCE("titleEn",'')) LIKE '${n.toLowerCase()}%'`,
      `lower(COALESCE("titleNative",'')) LIKE '${n.toLowerCase()}%'`,
      `lower(COALESCE("synonyms",'')) LIKE '%${n.toLowerCase()}%'`,
    ]);
    try {
      const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT "id","title","titleEn","titleNative","synonyms","cover","coverColor","type","classification"
         FROM "Work" WHERE ${PUBLIC_GATE} AND (${likes.join(" OR ")}) LIMIT 200`
      );
      for (const r of rows) {
        const w = parseWork(r);
        out.set(w.id, w);
      }
    } catch { /* chunk falhou → segue (matchWork perde só esses candidatos) */ }
    if (out.size >= 400) break;
  }
  return [...out.values()];
}

export async function GET() {
  if (g.__salesCache && Date.now() - g.__salesCache.at < TTL) {
    return cachedJson({ ok: true, ...g.__salesCache.data, cached: true });
  }
  try {
    const pool = await salesPool();

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
  } catch (e: any) {
    // isolamento: banco indisponível → stale na hora, senão ok:false (nunca 500)
    if (g.__salesCache?.data) return cachedJson({ ok: true, ...g.__salesCache.data, cached: true, stale: true });
    return cachedJson({ ok: false, error: String(e?.message ?? e) });
  }
}
