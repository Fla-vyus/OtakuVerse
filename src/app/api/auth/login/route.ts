import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSession, sessionCookie, rateLimit } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "login", 10, 60_000)) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde 1 minuto." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const id = String(body.id ?? "").trim().toLowerCase(); // email OU usuário
    const password = String(body.password ?? "");
    if (!id || !password) return NextResponse.json({ ok: false, error: "Informe usuário/e-mail e senha." }, { status: 400 });

    const user = await db.user.findFirst({
      where: { OR: [{ email: id }, { username: id }] },
    });
    if (!user || !(await verifyPassword(password, user.passHash))) {
      return NextResponse.json({ ok: false, error: "Credenciais inválidas." }, { status: 401 });
    }
    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await db.eventLog.create({ data: { userId: user.id, kind: "auth_login" } });

    const raw = await createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor, bio: user.bio, adultMode: user.adultMode, settings: user.settings },
    });
    res.cookies.set(sessionCookie(raw));
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
