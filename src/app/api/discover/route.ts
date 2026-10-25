import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { searchAniList, trendingAniList, toWorkRow } from "@/lib/anilist";

export const dynamic = "force-dynamic";

/** Busca ao vivo na AniList — salva os resultados no banco e devolve as obras */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const q: string = (body.q ?? "").trim();
    const type = body.type === "ANIME" ? "ANIME" : body.type === "MANGA" ? "MANGA" : undefined;
    let media: any[] = [];
    if (q) {
      media = await searchAniList(q, { type, perPage: 16 });
    } else {
      media = await trendingAniList(14);
    }
    for (const m of media) {
      const row = toWorkRow(m);
      await db.work.upsert({
        where: { id: row.id },
        create: row,
        update: {
          type: row.type,
          format: row.format,
          status: row.status,
          chapters: row.chapters,
          avgScore: row.avgScore,
          popularity: row.popularity,
          favourites: row.favourites,
          lastUpdate: row.lastUpdate,
          nextEpisodeAt: row.nextEpisodeAt,
          nextEpisodeNum: row.nextEpisodeNum,
        },
      });
    }
    const ids = media.map((m) => String(m.id));
    const rows = await db.work.findMany({ where: { id: { in: ids } } });
    const works = rows.map(parseWork).sort(
      (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
    );
    return NextResponse.json({ ok: true, works, live: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Falha ao consultar a AniList: " + e.message }, { status: 502 });
  }
}
