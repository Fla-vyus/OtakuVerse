import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";

export const dynamic = "force-dynamic";

function min(rows: any[]) {
  return rows.map(parseWork);
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const adult = sp.get("adult") === "1";
    const explicit = adult && sp.get("explicit") === "1";
    // Camadas: sem adult → geral; adult → spicy ≤1 + geral; adult+explicit → tudo
    const adultFilter = adult ? (explicit ? {} : { spicy: { lte: 1 } }) : { isAdult: false };
    const since120 = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const since45d = Math.floor(Date.now() / 1000) - 45 * 86400;

    const [heroHype, heroPopular, heroFresh, heroClassics, trending, recent, hotNew, manhwa, spicy, ln, anime, masterpieces, typeCounts, agg] = await Promise.all([
      // HYPE do momento: atualizou recentemente + audiência máxima (bombando agora)
      db.work.findMany({
        where: { lastUpdate: { gte: since45d }, popularity: { gte: 10000 }, ...adultFilter },
        orderBy: [{ follows: "desc" }, { popularity: "desc" }],
        take: 8,
      }),
      // Melhores de todos os tempos
      db.work.findMany({ where: adultFilter, orderBy: [{ popularity: "desc" }], take: 8 }),
      // Novos hits: estreias recentes que explodiram
      db.work.findMany({
        where: { startDate: { gte: "2025-01-01" }, popularity: { gte: 20000 }, ...adultFilter },
        orderBy: [{ popularity: "desc" }, { startDate: "desc" }],
        take: 8,
      }),
      // Clássicos eternos
      db.work.findMany({
        where: { startDate: { lte: "2016-12-31" }, favourites: { gte: 3000 }, ...adultFilter },
        orderBy: [{ favourites: "desc" }],
        take: 8,
      }),
      db.work.findMany({ where: adultFilter, orderBy: { popularity: "desc" }, take: 24 }),
      db.work.findMany({ where: { startDate: { gte: since120 }, ...adultFilter }, orderBy: [{ startDate: "desc" }, { popularity: "desc" }], take: 24 }),
      db.work.findMany({ where: { chapters: { lte: 5 }, status: "RELEASING", type: { in: ["manga", "manhwa"] }, startDate: { gte: since120 }, ...adultFilter }, orderBy: [{ avgScore: "desc" }, { popularity: "desc" }], take: 20 }),
      db.work.findMany({ where: { type: "manhwa", ...adultFilter }, orderBy: { popularity: "desc" }, take: 22 }),
      // Picante: respeita as camadas (spicy 1 comum; 2 só com explicit)
      db.work.findMany({ where: explicit ? { spicy: 2 } : { spicy: 1 }, orderBy: { favourites: "desc" }, take: 20 }),
      db.work.findMany({ where: { type: "lightnovel", ...adultFilter }, orderBy: { favourites: "desc" }, take: 18 }),
      db.work.findMany({ where: { type: "anime", ...adultFilter }, orderBy: { popularity: "desc" }, take: 22 }),
      db.work.findMany({ where: { avgScore: { gte: 82 }, ...adultFilter }, orderBy: [{ avgScore: "desc" }, { popularity: "desc" }], take: 22 }),
      db.work.groupBy({ by: ["type"], _count: { _all: true }, where: adultFilter }),
      db.work.aggregate({ _sum: { chapters: true, episodes: true }, _count: { _all: true }, where: adultFilter }),
    ]);

    return NextResponse.json({
      ok: true,
      adult,
      explicit,
      heroModes: {
        hype: min(heroHype),
        popular: min(heroPopular),
        fresh: min(heroFresh),
        classics: min(heroClassics),
      },
      trending: min(trending),
      recent: min(recent),
      hotNew: min(hotNew),
      manhwa: min(manhwa),
      spicy: min(spicy),
      ln: min(ln),
      anime: min(anime),
      masterpieces: min(masterpieces),
      stats: {
        total: agg._count._all,
        chapters: agg._sum.chapters ?? 0,
        episodes: agg._sum.episodes ?? 0,
        byType: typeCounts.map((t) => ({ type: t.type, count: t._count._all })),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
