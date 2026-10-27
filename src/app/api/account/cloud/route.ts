// Nuvem do OtakuVerse:
// - GET  → puxa TUDO da conta (perfil, prateleira, listas) para restaurar em
//          qualquer dispositivo. É o "download da nuvem" do cliente.
// - POST → backup exportável em JSON (portabilidade LGPD).
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });

    const [shelf, lists] = await Promise.all([
      db.shelfEntry.findMany({
        where: { userId: user.id },
        select: { workId: true, status: true, rating: true, progress: true, note: true, createdAt: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
      db.userList.findMany({
        where: { userId: user.id },
        select: { id: true, name: true, emoji: true, description: true, workIds: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      syncedAt: Date.now(),
      user: {
        id: user.id, username: user.username, displayName: user.displayName, bio: user.bio,
        avatarHue: user.avatarHue, bannerHue: user.bannerHue,
        prefs: user.prefs ? JSON.parse(user.prefs) : null, createdAt: user.createdAt,
      },
      counts: {
        shelf: shelf.length,
        lists: lists.length,
        byStatus: Object.fromEntries(shelf.reduce((m: Map<string, number>, s) => m.set(s.status, (m.get(s.status) ?? 0) + 1), new Map())),
      },
      shelf,
      lists: lists.map((l) => ({ ...l, workIds: JSON.parse(l.workIds) })),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const data = await db.user.findUnique({
      where: { id: user.id },
      select: {
        username: true, displayName: true, bio: true, avatarHue: true, bannerHue: true, prefs: true,
        createdAt: true, shelf: true, lists: true,
      },
    });
    const payload = {
      app: "OtakuVerse",
      kind: "backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      user: data ? { ...data, passwordHash: undefined } : null,
      notice: "Backup portável da sua conta (LGPD art. 18, II — portabilidade). Guarde em local seguro.",
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="otakuverse-backup-${user.username}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
