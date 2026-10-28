// Revistas & editoras — catálogo agrupado por revista de publicação real.
// Metadados editoriais das revistas conhecidas + contagens e capas do catálogo.
import { NextResponse } from "next/server";
import { getAllWorks } from "@/lib/works";
import { MAGAZINES, type Magazine } from "@/lib/magazines";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __magsCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

export async function GET() {
  if (g.__magsCache && Date.now() - g.__magsCache.at < TTL) {
    return cachedJson({ ok: true, ...g.__magsCache.data, cached: true });
  }
  try {
    const all = await getAllWorks();

  // agrupa por nome de revista presente no banco (dado real de MangaUpdates/derivado)
  const groups = new Map<string, { works: typeof all; info: any }>();
  for (const w of all) {
    if (!w.magazine?.name || !w.cover) continue;
    const key = w.magazine.name;
    if (!groups.has(key)) groups.set(key, { works: [], info: w.magazine });
    groups.get(key)!.works.push(w);
  }

  // enriquece com a ficha canônica da revista (quando conhecida)
  const canon = new Map<string, Magazine>(MAGAZINES.map((m) => [m.name, m]));

  const magazines = [...groups.entries()]
    .map(([name, { works, info }]) => {
      const c = canon.get(name);
      const top = [...works].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 6);
      return {
        name,
        publisher: c?.publisher ?? info?.publisher ?? null,
        demographic: c?.demographic ?? info?.demographic ?? null,
        schedule: c?.schedule ?? info?.schedule ?? null,
        country: c?.country ?? info?.country ?? null,
        count: works.length,
        covers: top.map((w) => ({ id: w.id, title: w.title, cover: w.cover, coverColor: w.coverColor ?? null })),
        sample: top.slice(0, 3).map((w) => ({ id: w.id, title: w.title })),
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
