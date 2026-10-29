// Revistas & editoras — catálogo agrupado por revista de publicação real.
// v4.0: UMA query com window function (ROW_NUMBER por revista, top-6 obras) —
// sem pool em memória. Metadados editoriais das revistas conhecidas + contagens.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { MAGAZINES, type Magazine } from "@/lib/magazines";
import { cachedJson } from "@/lib/httpCache";
import type { WorkData } from "@/lib/types";

export const dynamic = "force-dynamic";

const WGATE = `w."classification" != 'adult' AND w."type" != 'drama'`;

const g = globalThis as unknown as { __magsCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

export async function GET() {
  if (g.__magsCache && Date.now() - g.__magsCache.at < TTL) {
    return cachedJson({ ok: true, ...g.__magsCache.data, cached: true });
  }
  try {
    // top-6 obras por revista (contagem total via GROUP BY à parte)
    const [topRows, countRows] = await Promise.all([
      db.$queryRawUnsafe<Record<string, unknown>[]>(
        `SELECT * FROM (
           SELECT w.*, json_extract(w."magazine",'$.name') AS mname,
                  ROW_NUMBER() OVER (PARTITION BY json_extract(w."magazine",'$.name') ORDER BY w."popularity" DESC) AS rn
           FROM "Work" w
           WHERE w."magazine" IS NOT NULL AND json_extract(w."magazine",'$.name') IS NOT NULL
             AND json_extract(w."magazine",'$.name') != '' AND w."cover" != '' AND ${WGATE}
         ) WHERE rn <= 6 ORDER BY mname`
      ),
      db.$queryRawUnsafe<{ name: string; count: number }[]>(
        `SELECT json_extract(w."magazine",'$.name') AS name, COUNT(*) AS count
         FROM "Work" w
         WHERE w."magazine" IS NOT NULL AND json_extract(w."magazine",'$.name') IS NOT NULL
           AND json_extract(w."magazine",'$.name') != '' AND w."cover" != '' AND ${WGATE}
         GROUP BY name HAVING COUNT(*) >= 2`
      ),
    ]);

    // agrupa as top obras por revista (info editorial da 1ª obra do grupo)
    const groups = new Map<string, { works: WorkData[]; info: any }>();
    for (const r of topRows) {
      const w = parseWork(r);
      const name = String((r as any).mname);
      if (!groups.has(name)) groups.set(name, { works: [], info: w.magazine });
      groups.get(name)!.works.push(w);
    }
    const counts = new Map(countRows.map((r) => [String(r.name), Number(r.count)]));

    // enriquece com a ficha canônica da revista (quando conhecida)
    const canon = new Map<string, Magazine>(MAGAZINES.map((m) => [m.name, m]));

    const magazines = [...groups.entries()]
      .map(([name, { works, info }]) => {
        const c = canon.get(name);
        return {
          name,
          publisher: c?.publisher ?? info?.publisher ?? null,
          demographic: c?.demographic ?? info?.demographic ?? null,
          schedule: c?.schedule ?? info?.schedule ?? null,
          country: c?.country ?? info?.country ?? null,
          count: counts.get(name) ?? works.length,
          covers: works.map((w) => ({ id: w.id, title: w.title, cover: w.cover, coverColor: w.coverColor ?? null })),
          sample: works.slice(0, 3).map((w) => ({ id: w.id, title: w.title })),
        };
      })
      .filter((m) => m.count >= 2);

    // revistas reais primeiro; coletâneas genéricas derivadas ficam fora da grade principal
    const GENERIC = (n: string) => n.startsWith("Antologia") || n === "Webtoon (Coreia)" || n === "Manhua digital";
    const realMagazines = magazines.filter((m) => !GENERIC(m.name)).sort((a, b) => b.count - a.count);
    const genericWorks = magazines.filter((m) => GENERIC(m.name)).reduce((s, m) => s + m.count, 0);

    const data = {
      magazines: realMagazines,
      total: realMagazines.length,
      worksWithMagazine: realMagazines.reduce((s, m) => s + m.count, 0),
      genericWorks,
    };
    g.__magsCache = { at: Date.now(), data };
    return cachedJson({ ok: true, ...data });
  } catch (e: any) {
    // isolamento: banco indisponível → stale na hora, senão ok:false (nunca 500)
    if (g.__magsCache?.data) return cachedJson({ ok: true, ...g.__magsCache.data, cached: true, stale: true });
    return cachedJson({ ok: false, error: String(e?.message ?? e) });
  }
}
