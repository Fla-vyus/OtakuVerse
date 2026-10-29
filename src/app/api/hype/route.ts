// Carrossel do topo: "O que está bombando agora" (hype) com modos trocáveis.
// Modos: hype (tendência real AniList) | score (melhores notas) | new (novidades) | classic (clássicos atemporais)
import { NextRequest, NextResponse } from "next/server";
import { anilistFetch, toWorkRow, SEARCH_FIELDS } from "@/lib/anilist";
import { db } from "@/lib/db";
import { classify } from "@/lib/works";
import { parseWork } from "@/lib/types";
import { selectCards, PUBLIC_GATE } from "@/lib/works-sql";
import { cachedVolatile } from "@/lib/httpCache";

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
    return cachedVolatile({ ok: true, mode, items: g.__hypeCache.data[mode], cached: true });
  }

  // 1) tenta ao vivo na AniList (hype REAL do momento)
  try {
    const data = await anilistFetch(MODES[mode].query, MODES[mode].vars, { timeoutMs: 8000 });
    const media: any[] = data?.Page?.media ?? [];
    const items = media.map((m) => parseWork(toWorkRow(m)));
    // persiste em background (mantém o catálogo fresco). v4.0: sem pool para invalidar.
    (async () => {
      try {
        for (const m of media) {
          await db.work.upsert({
            where: { id: String(m.id) },
            create: { ...toWorkRow(m), ...classRow(m) },
            update: toWorkRow(m),
          });
        }
      } catch {}
    })();

    g.__hypeCache = { ...(g.__hypeCache ?? { at: 0, data: {} }), at: Date.now(), data: { ...(g.__hypeCache?.data ?? {}), [mode]: items } };
    return cachedVolatile({ ok: true, mode, items, source: "anilist-live" });
  } catch {
    // 2) fallback: SQL direto (top por popularidade com banner/tração)
    try {
      const orderBy: Record<string, string> = {
        hype: `"popularity" DESC`,
        score: `"avgScore" DESC`,
        new: `"startDate" DESC`,
        classic: `"favourites" DESC`,
      };
      const items = await selectCards(
        `${PUBLIC_GATE} AND ("banner" IS NOT NULL OR "popularity" > 50000)`,
        [], orderBy[mode] ?? orderBy.hype, 14
      );
      return cachedVolatile({ ok: true, mode, items, source: "db" });
    } catch {
      return NextResponse.json({ ok: false, error: "Fontes temporariamente indisponíveis", items: [] }, { status: 200 });
    }
  }
}

function classRow(m: any) {
  // classificação consistente com o resto do sistema (ecchi/suggestive detectado pelas tags)
  const cls = classify(m);
  return { isAdult: !!m.isAdult, classification: cls.classification, adultTags: cls.adultTags, spicy: cls.spicy };
}
