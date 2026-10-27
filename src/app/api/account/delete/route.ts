// Exclusão de conta (direito LGPD de eliminação) — exige senha.
// Apaga em cascata: prateleira, listas e o próprio usuário.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, verifyPassword, clearCookieHeader } from "@/lib/auth";
import { rateLimit, tooMany, isSecureReq } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const rl = rateLimit(`del:${user.id}`, 3, 15 * 60_000);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const { password } = await req.json();
    if (!verifyPassword(String(password ?? ""), user.passwordHash)) {
      return NextResponse.json({ ok: false, error: "Senha incorreta — conta não excluída" }, { status: 403 });
    }
    await db.user.delete({ where: { id: user.id } });
    return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearCookieHeader(isSecureReq(req)) } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
