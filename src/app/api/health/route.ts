// Health check do OtakuVerse — v4.0 LEVE (regra da plataforma com pouca RAM):
// NÃO consulta o banco, NÃO olha pool (não existe mais), NÃO importa módulos
// pesados. Responde só: ok, uptime, rssMB, modo do banco e aviso explícito
// quando produção subiu sem Turso. Diagnóstico profundo fica no /api/diag.
import { NextResponse } from "next/server";
import { isRemoteDb } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";

export async function GET() {
  const mem = process.memoryUsage();
  const rssMB = Math.round(mem.rss / 1048576);

  const productionWithoutTurso = !isRemoteDb && process.env.NODE_ENV === "production";
  const ok = !productionWithoutTurso && rssMB < 450;

  const body: Record<string, unknown> = {
    ok,
    status: ok ? "healthy" : productionWithoutTurso ? "misconfigured" : "degraded",
    uptimeS: Math.round(process.uptime()),
    rssMB,
    dbMode: isRemoteDb ? "turso-cloud" : "sqlite-local",
    at: new Date().toISOString(),
  };
  if (productionWithoutTurso) {
    body.aviso = "PRODUÇÃO SEM TURSO: DATABASE_URL não aponta para libsql:// — o catálogo NÃO carrega. Verifique otakuverse.runtime.json no payload (veja /api/diag).";
  }
  if (!ok && !productionWithoutTurso) {
    body.aviso = `memória alta (${rssMB}MB) — instância pode ser reciclada`;
  }

  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
