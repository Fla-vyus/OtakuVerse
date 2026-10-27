// Segurança da conta: troca de senha (exige senha atual, invalida sessões antigas
// via tokenVersion) e "encerrar todas as sessões".
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword, hashPassword, signSession, sessionCookieHeader } from "@/lib/auth";
import { rateLimit, tooMany, checkPassword, isSecureReq } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const rl = rateLimit(`pw:${user.id}`, 5, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter, "Muitas tentativas. Aguarde alguns minutos.");

    const { current, next } = await req.json();
    if (!verifyPassword(String(current ?? ""), user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Senha atual incorreta" }, { status: 403 });
    }
    const verdict = checkPassword(String(next ?? ""));
    if (!verdict.ok) {
      return NextResponse.json({ ok: false, error: `Senha nova fraca: ${verdict.problems.join(", ")}` }, { status: 400 });
    }
    if (verifyPassword(String(next ?? ""), user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "A senha nova precisa ser diferente da atual" }, { status: 400 });
    }
    // tokenVersion++ invalida TODAS as sessões anteriores (inclui a atual) —
    // devolvemos um cookie novo já válido.
    const tokenVersion = user.tokenVersion + 1;
    const updated = await db.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(String(next)), tokenVersion },
    });
    return NextResponse.json({ ok: true }, {
      headers: { "Set-Cookie": sessionCookieHeader(signSession(user.id, updated.tokenVersion), isSecureReq(req)) },
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

    const tokenVersion = user.tokenVersion + 1;
    const updated = await db.user.update({ where: { id: user.id }, data: { tokenVersion } });
    return NextResponse.json({ ok: true }, {
      headers: { "Set-Cookie": sessionCookieHeader(signSession(user.id, updated.tokenVersion), isSecureReq(req)) },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
