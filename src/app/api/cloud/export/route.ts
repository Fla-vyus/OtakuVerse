// Backup completo da nuvem (biblioteca + perfil + configurações) para download
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const items = await db.libraryItem.findMany({ where: { userId: user.id } });
  const backup = {
    app: "OtakuVerse",
    version: 2,
    exportedAt: new Date().toISOString(),
    profile: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarColor: user.avatarColor,
      settings: JSON.parse(user.settings ?? "{}"),
      adultMode: user.adultMode,
    },
    library: items.map((i) => ({
      workId: i.workId,
      status: i.status,
      rating: i.rating,
      note: i.note,
      updatedAt: i.updatedAt.toISOString(),
    })),
  };
  await db.eventLog.create({ data: { userId: user.id, kind: "cloud_export" } });
  return new NextResponse(JSON.stringify(backup, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="otakuverse-backup-${user.username}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
  } catch (e: any) {
    // isolamento: export nunca deve derrubar o cliente com 500 sem JSON
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
