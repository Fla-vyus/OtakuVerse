// Carrossel do topo: "O que está bombando agora" (hype) com modos trocáveis.
// Modos: hype (tendência real AniList) | score (melhores notas) | new (novidades) | classic (clássicos atemporais)
import { NextRequest, NextResponse } from "next/server";
import { anilistFetch, toWorkRow, SEARCH_FIELDS } from "@/lib/anilist";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { invalidateWorksCache } from "@/lib/works";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __hypeCache?: { at: number; data: Record<string, any[]> } };
const TTL = 10 * 60_000;

const MODES: Record<string, { query: string; vars: Record<string, unknown> }> = {
  hype: {
    query: `query ($p: Int) { Page(perPage: $p) { media(sort: TRENDING_DESC, isAdult: false) { ${SEARCH_FIELDS} } } }`,
    vars: { p: 14 },
  },
  score: {
    query: `query ($p: Int) { Page(perPage: $p) { media(sort: SCORE_DESC, isAdult: false, startDate_greater: 1509460800) { ${SEARCH_FIELDS} } } }`,
    vars: { p: 14 },
  },
  new: {
    query: `query ($p: Int) { Page(perPage: $p) { media(sort: POPULARITY_DESC, isAdult: false, status_in: [RELEASING, NOT_YET_RELEASED], startDate_greater: 1704067200) { ${SEARCH_FIELDS} } } }`,
    vars: { p: 14 },
  },
  classic: {
    query: `query ($p: Int) { Page(perPage: $p) { media(sort: FAVOURITES_DESC, isAdult: false, startDate_lesser: 1451606400) { ${SEARCH_FIELDS} } } }`,
    vars: { p: 14 },
  },
};

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("mode") ?? "hype";
  if (!MODES[mode]) return NextResponse.json({ ok: false, error: "Modo inválido" }, { status: 400 });

  if (g.__hypeCache && Date.now() - g.__hypeCache.at < TTL && g.__hypeCache.data[mode]) {
    return NextResponse.json({ ok: true, mode, items: g.__hypeCache.data[mode], cached: true });
  }

  // 1) tenta ao vivo na AniList (hype REAL do momento)
  try {
    const data = await anilistFetch(MODES[mode].query, MODES[mode].vars);
    const media: any[] = data?.Page?.media ?? [];
    const items = media.map((m) => parseWork(toWorkRow(m)));
    // persiste em background (mantém o catálogo fresco)
    Promise.all(
      media.map((m) =>
        db.work.upsert({
          where: { id: String(m.id) },
          create: { ...toWorkRow(m), ...classRow(m) },
          update: toWorkRow(m),
        })
      )
    )
      .then(() => invalidateWorksCache())
      .catch(() => {});

    g.__hypeCache = { ...(g.__hypeCache ?? { at: 0, data: {} }), at: Date.now(), data: { ...(g.__hypeCache?.data ?? {}), [mode]: items } };
    return NextResponse.json({ ok: true, mode, items, source: "anilist-live" });
  } catch {
    // 2) fallback: ordena o banco local
    const { getAllWorks } = await import("@/lib/works");
    const all = await getAllWorks();
    const sorters: Record<string, (a: any, b: any) => number> = {
      hype: (a, b) => (b.popularity ?? 0) - (a.popularity ?? 0),
      score: (a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0),
      new: (a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""),
      classic: (a, b) => (b.favourites ?? 0) - (a.favourites ?? 0),
    };
    const items = all
      .filter((w) => w.banner || (w.popularity ?? 0) > 50000)
      .sort(sorters[mode])
      .slice(0, 14);
    return NextResponse.json({ ok: true, mode, items, source: "db" });
  }
}

function classRow(m: any) {
  // reuso leve — classificação completa acontece no seed; aqui só adult flag
  return { isAdult: !!m.isAdult, classification: m.isAdult ? "adult" : "safe" };
}
