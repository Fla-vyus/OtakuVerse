// Importa backup JSON (mescla por last-write-wins)
import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["reading", "completed", "plan", "paused", "dropped", "favorite"]);

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    const body = await req.json().catch(() => null);
    if (!body || body.app !== "OtakuVerse" || !Array.isArray(body.library)) {
      return NextResponse.json({ ok: false, error: "Arquivo de backup inválido." }, { status: 400 });
    }
    let imported = 0;
    for (const it of body.library.slice(0, 5000)) {
      const workId = String(it.workId ?? "");
      if (!workId || workId.length > 64) continue;
      const status = STATUSES.has(it.status) ? it.status : "plan";
      const rating = Number.isInteger(it.rating) && it.rating >= 0 && it.rating <= 10 ? it.rating : null;
      const note = typeof it.note === "string" ? it.note.slice(0, 1000) : null;
      const clientUpdatedAt = it.updatedAt ? new Date(it.updatedAt) : null;
      if (clientUpdatedAt && isNaN(clientUpdatedAt.getTime())) continue;
      await db.libraryItem.upsert({
        where: { userId_workId: { userId: user.id, workId } },
        create: { userId: user.id, workId, status, rating, note, updatedAt: clientUpdatedAt ?? new Date() },
        update: clientUpdatedAt && clientUpdatedAt.getTime() > Date.now() - 86400000 ? {} : { status, rating, note, updatedAt: clientUpdatedAt ?? new Date() },
      });
      imported++;
    }
    // restaura configurações do perfil se presentes
    if (body.profile && typeof body.profile === "object") {
      const p = body.profile;
      await db.user.update({
        where: { id: user.id },
        data: {
          displayName: typeof p.displayName === "string" ? p.displayName.slice(0, 40) : undefined,
          bio: typeof p.bio === "string" ? p.bio.slice(0, 400) : undefined,
          avatarColor: typeof p.avatarColor === "string" && /^#[0-9a-fA-F]{6}$/.test(p.avatarColor) ? p.avatarColor : undefined,
          settings: p.settings && typeof p.settings === "object" ? JSON.stringify(p.settings) : undefined,
        },
      });
    }
    await db.eventLog.create({ data: { userId: user.id, kind: "cloud_import", payload: JSON.stringify({ imported }) } });
    return NextResponse.json({ ok: true, imported });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
