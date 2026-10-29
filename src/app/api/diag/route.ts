// /api/diag — v3.9.7: observabilidade remota do container da plataforma.
// A plataforma não dá acesso a logs do container; este endpoint revela, SEM
// expor segredos (nunca imprime valores — só presença/forma/origem):
//   · qual DATABASE_URL o processo realmente carrega (turso vs file:/app/…)
//   · se o runtime json embarcou no standalone (raiz/pai)
//   · credenciais AI/Turso presentes (boolean por tamanho)
//   · tail do events.log (flightlog v3.9.4: boot/watchdog/refresh/crash)
// Uso pós-publish: curl https://<site>/api/diag | jq
import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";

export const dynamic = "force-dynamic";

const mask = (v?: string) => (v && v.length > 0 ? `definida (${v.length} chars)` : "AUSENTE");

export async function GET() {
  const env = process.env;
  const dbUrl = env.DATABASE_URL ?? "";
  const dbSafe = /^libsql:\/\//i.test(dbUrl)
    ? `libsql://${dbUrl.replace(/^libsql:\/\//, "").split(".")[0]}…`
    : dbUrl || "(vazia)";

  let events: string[] = [];
  try {
    const p = `${process.cwd()}/data/events.log`;
    if (existsSync(p)) events = readFileSync(p, "utf8").trim().split("\n").slice(-12);
  } catch {
    events = ["(events.log ilegível)"];
  }
  if (events.length === 0) events = ["(events.log vazio/ausente)"];

  return NextResponse.json(
    {
      ok: true,
      at: new Date().toISOString(),
      uptimeS: Math.round(process.uptime()),
      node: process.version,
      cwd: process.cwd(),
      db: {
        url: dbSafe,
        mode: /^libsql:\/\//i.test(dbUrl) ? "turso" : dbUrl ? "file" : "indefinido",
        tursoToken: mask(env.TURSO_AUTH_TOKEN),
      },
      runtimeJson: {
        standalone: existsSync(`${process.cwd()}/otakuverse.runtime.json`),
        pai: existsSync(`${process.cwd()}/../otakuverse.runtime.json`),
      },
      ai: {
        key: mask(env.AI_API_KEY),
        base: env.AI_BASE_URL ? "definida" : "AUSENTE",
        model: env.AI_MODEL ?? "AUSENTE",
      },
      poolMax: env.OTAKUVERSE_POOL_MAX ?? null,
      events,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
