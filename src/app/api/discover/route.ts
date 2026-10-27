import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { searchAniList, trendingAniList, toWorkRow } from "@/lib/anilist";
import { classify } from "@/lib/works";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Busca ao vivo na AniList — salva os resultados no banco e devolve as obras.
 *  Nunca retorna conteúdo adulto (a menos que o usuário tenha modo +18 e peça explicitamente). */
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

    const user = await getSessionUser();
    const adultAllowed = !!user?.adultMode;
    media = media.filter((m) => adultAllowed || !m.isAdult);

    for (const m of media) {
      const row = toWorkRow(m);
      const cls = classify(m);
      await db.work.upsert({
        where: { id: row.id },
        create: { ...row, classification: cls.classification, adultTags: cls.adultTags },
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
    const rows = ids.length ? await db.work.findMany({ where: { id: { in: ids } } }) : [];
    const works = rows.map(parseWork).sort(
      (a, b) => ids.indexOf(a.id) - ids.indexOf(b.id)
    );
    return NextResponse.json({ ok: true, items: works, works, live: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Falha ao consultar a AniList: " + e.message }, { status: 502 });
  }
}
