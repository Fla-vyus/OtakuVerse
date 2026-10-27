import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { searchAniList, trendingAniList, toWorkRow } from "@/lib/anilist";
import { classify } from "@/lib/works";
import { getSessionUser } from "@/lib/auth";
import { rateLimit, tooMany, clientIp } from "@/lib/security";

export const dynamic = "force-dynamic";

/** Busca ao vivo na AniList — salva os resultados no banco e devolve as obras.
 *  Nunca retorna conteúdo adulto (a menos que o usuário tenha modo +18 e peça explicitamente).
 *  Aceita POST { q, type } e GET ?q=&type= (a busca ao vivo do Explorar usa GET). */
async function run(q: string, type: string | undefined) {
  let media: any[] = [];
  if (q) {
    media = await searchAniList(q, { type: type === "ANIME" ? "ANIME" : type === "MANGA" ? "MANGA" : undefined, perPage: 16 });
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
      create: { ...row, ...cls },
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
  return works;
}

export async function POST(req: NextRequest) {
  const rl = rateLimit(`discover:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const body = await req.json().catch(() => ({}));
    const q = String(body.q ?? "").trim().slice(0, 100);
    const works = await run(q, body.type);
    return NextResponse.json({ ok: true, items: works, works, live: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Falha ao consultar a AniList: " + e.message }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(`discover:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) return tooMany(rl.retryAfter);
  try {
    const sp = req.nextUrl.searchParams;
    const q = (sp.get("q") ?? "").trim().slice(0, 100);
    const works = await run(q, sp.get("type") ?? undefined);
    return NextResponse.json({ ok: true, items: works, works, live: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "Falha ao consultar a AniList: " + e.message }, { status: 502 });
  }
}
