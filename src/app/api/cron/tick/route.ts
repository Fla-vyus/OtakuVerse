// Tick do agendador EXTERNO (scheduler-daemon.sh): dispara o refresh do catálogo
// dentro do processo do servidor — reusa pool, broker e caches, sem RAM extra.
//
// PERMANÊNCIA EM 3 CAMADAS:
//   1. instrumentation.ts → setInterval de 30min dentro do servidor (sobrevive a quedas do daemon)
//   2. scheduler-daemon.sh → daemon double-fork que dá o tick a cada 30min via HTTP (sobrevive a
//      reinícios do servidor; deploy.sh o relança)
//   3. doRefresh() tem guarda __cronRunning → as duas camadas nunca rodam em paralelo
//
// TRANCADA: exige ?key=CRON_KEY (mesma chave do /api/cron/refresh). Sem chave configurada, 403.
import { NextRequest, NextResponse } from "next/server";
import { doRefresh } from "../refresh/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // v3.8 — aceita chave por query (?key=, daemon local) OU header
  // Authorization: Bearer (Vercel Cron injeta CRON_SECRET automaticamente).
  const key =
    req.nextUrl.searchParams.get("key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_KEY ?? process.env.CRON_SECRET;
  if (!expected || key !== expected) {
    return NextResponse.json({ ok: false, error: "Chave inválida" }, { status: 403 });
  }
  const at = Date.now();
  try {
    const res = await doRefresh();
    return NextResponse.json({ ok: true, ...res, ms: Date.now() - at });
  } catch (e: any) {
    // nunca derruba o chamador: o próximo tick em 30min tenta de novo
    return NextResponse.json({ ok: false, error: String(e?.message ?? e), ms: Date.now() - at }, { status: 200 });
  }
}
