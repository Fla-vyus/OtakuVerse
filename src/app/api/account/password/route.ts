// Segurança da conta: troca de senha (exige senha atual, invalida sessões antigas
// via tokenVersion) e "encerrar todas as sessões".
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword, hashPassword, signSession, sessionCookieHeader, SESSION_COOKIE } from "@/lib/auth";
import { rateLimit, tooMany, checkPassword, isSecureReq } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const rl = rateLimit(`pw:${user.id}`, 5, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter, "Muitas tentativas. Aguarde alguns minutos.");

    const { current, next } = await req.json();
    if (!(await verifyPassword(String(current ?? ""), user.passHash))) {
      return NextResponse.json({ ok: false, error: "Senha atual incorreta" }, { status: 403 });
    }
    const verdict = checkPassword(String(next ?? ""));
    if (!verdict.ok) {
      return NextResponse.json({ ok: false, error: `Senha nova fraca: ${verdict.problems.join(", ")}` }, { status: 400 });
    }
    if (await verifyPassword(String(next ?? ""), user.passHash)) {
      return NextResponse.json({ ok: false, error: "A senha nova precisa ser diferente da atual" }, { status: 400 });
    }
    // Troca de senha invalida TODAS as sessões anteriores (inclui a atual) —
    // emitimos um cookie novo já válido.
    await db.session.deleteMany({ where: { userId: user.id } });
    const updated = await db.user.update({
      where: { id: user.id },
      data: { passHash: await hashPassword(String(next)), tokenVersion: { increment: 1 } },
    });
    const raw = await signSession(user.id, updated.tokenVersion);
    return NextResponse.json({ ok: true }, {
      headers: { "Set-Cookie": sessionCookieHeader(raw, isSecureReq(req)) },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

/** Encerra todas as outras sessões desta conta (mantém a atual) */
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const rl = rateLimit(`logoutall:${user.id}`, 5, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    // Encerra todas as OUTRAS sessões (mantém a atual, identificada pelo cookie)
    const { cookies } = await import("next/headers");
    const store = await cookies();
    const currentRaw = store.get(SESSION_COOKIE)?.value ?? null;
    const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
    await db.user.update({ where: { id: user.id }, data: { tokenVersion: { increment: 1 } } });
    await db.session.deleteMany({
      where: { userId: user.id, ...(currentRaw ? { NOT: { token: sha256(currentRaw) } } : {}) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
