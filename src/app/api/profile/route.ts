import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, ua: true },
  });
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id, email: user.email, username: user.username, displayName: user.displayName,
      avatarColor: user.avatarColor, bio: user.bio, adultMode: user.adultMode, adultConsent: user.adultConsent,
      settings: user.settings, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt,
    },
    sessions,
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const data: any = {};

    if (typeof body.displayName === "string") data.displayName = body.displayName.slice(0, 40);
    if (typeof body.bio === "string") data.bio = body.bio.slice(0, 400);
    if (typeof body.avatarColor === "string" && /^#[0-9a-fA-F]{6}$/.test(body.avatarColor)) data.avatarColor = body.avatarColor;
    if (body.settings && typeof body.settings === "object") data.settings = JSON.stringify(body.settings);

    // Modo +18: exige consentimento explícito registrado (com data) — portão escondido no perfil
    if (typeof body.adultMode === "boolean") {
      if (body.adultMode) {
        if (!body.adultConsent) return NextResponse.json({ ok: false, error: "Consentimento +18 obrigatório." }, { status: 400 });
        data.adultMode = true;
        data.adultConsent = new Date().toISOString();
      } else {
        data.adultMode = false;
      }
    }

    await db.user.update({ where: { id: user.id }, data });
    if (typeof body.adultMode === "boolean") {
      await db.eventLog.create({ data: { userId: user.id, kind: "adult_toggle", payload: JSON.stringify({ enabled: body.adultMode }) } });
    }
    const fresh = await db.user.findUnique({ where: { id: user.id } });
    return NextResponse.json({
      ok: true,
      user: {
        id: fresh!.id, email: fresh!.email, username: fresh!.username, displayName: fresh!.displayName,
        avatarColor: fresh!.avatarColor, bio: fresh!.bio, adultMode: fresh!.adultMode, adultConsent: fresh!.adultConsent,
        settings: fresh!.settings,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
