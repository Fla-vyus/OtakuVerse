import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, sessionCookie, rateLimit, validateRegistration } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(req, "register", 8, 60_000)) {
      return NextResponse.json({ ok: false, error: "Muitas tentativas. Aguarde 1 minuto." }, { status: 429 });
    }
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const accepted = !!body.acceptedTerms;
    const adultConsent = !!body.adultConsent;

    const invalid = validateRegistration(email, username, password, accepted);
    if (invalid) return NextResponse.json({ ok: false, error: invalid }, { status: 400 });

    const exists = await db.user.findFirst({ where: { OR: [{ email }, { username }] } });
    if (exists) {
      const field = exists.email === email ? "e-mail" : "usuário";
      return NextResponse.json({ ok: false, error: `Este ${field} já está cadastrado.` }, { status: 409 });
    }

    const passHash = await hashPassword(password);
    const palette = ["#2563eb", "#0891b2", "#7c3aed", "#db2777", "#059669", "#d97706", "#dc2626", "#4f46e5"];
    const user = await db.user.create({
      data: {
        email,
        username,
        passHash,
        displayName: username,
        avatarColor: palette[Math.floor(Math.random() * palette.length)],
        settings: JSON.stringify({ theme: "azul", hypeMode: "hype", adultConsentAsked: adultConsent }),
        adultMode: false,
      },
    });

    await db.eventLog.create({ data: { userId: user.id, kind: "auth_register", payload: JSON.stringify({ ua: req.headers.get("user-agent")?.slice(0, 100) }) } });

    const raw = await createSession(user.id, req.headers.get("user-agent"));
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor, adultMode: user.adultMode, settings: user.settings },
    });
    res.cookies.set(sessionCookie(raw));
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
