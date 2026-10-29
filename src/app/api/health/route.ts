// Health check do OtakuVerse — para monitoramento (watchdog interno, uptime externo).
// Retorna rápido e SEMPRE 200 com o estado de cada componente (nunca derruba o monitor).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isRemoteDb } from "@/lib/runtime-env";
import { peekStaleCache } from "@/lib/works";
import { existsSync } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const checks: Record<string, any> = {};

  // banco — com guarda de tempo (v3.9.3): um banco inalcançável não pode pendurar
  // o health check da plataforma (connect pendurado → container morto por timeout).
  // O erro aparece AQUI, legível de fora — diagnóstico remoto sem acesso aos logs.
  const t0 = Date.now();
  try {
    await Promise.race([
      db.$queryRawUnsafe("SELECT 1"),
      new Promise((_, rej) =>
        setTimeout(() => rej(new Error("timeout 4s — banco não respondeu (rede de saída ou credenciais)")), 4000)
      ),
    ]);
    checks.database = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.database = { ok: false, ms: Date.now() - t0, error: String(e?.message ?? e).slice(0, 160) };
  }

  // pool de obras (cache quente = site navegável mesmo com banco sob pressão)
  const pool = peekStaleCache();
  checks.worksCache = { ok: (pool?.works.length ?? 0) > 0, size: pool?.works.length ?? 0 };

  // durabilidade
  // v3.9.1: em modo libsql (Turso) os jobs de disco ficam DESLIGADOS de propósito —
  // backup/PITR/snapshot são responsabilidade do Turso Cloud. Reportar ok:false aqui
  // era falso positivo e colocava o keepalive em loop de reinício (health 200 com
  // "ok":false em qualquer check → 4 checagens → restart a cada ~2min).
  try {
    if (isRemoteDb) {
      const hasSnapshot = existsSync(process.cwd() + "/data/catalog-snapshot.jsonl.gz");
      checks.durability = { ok: true, modo: "turso-cloud", backupLocal: false, snapshotGitSafe: hasSnapshot };
    } else {
      const hasBackup = existsSync(process.cwd() + "/db/backups");
      const hasSnapshot = existsSync(process.cwd() + "/data/catalog-snapshot.jsonl.gz");
      const hasVault = existsSync("/home/z/otakuverse-vault/latest/manifesto.json");
      checks.durability = { ok: hasBackup && hasSnapshot, backup: hasBackup, snapshotGitSafe: hasSnapshot, vaultExterno: hasVault };
    }
  } catch {
    checks.durability = { ok: false };
  }

  // memória
  const mem = process.memoryUsage();
  checks.memory = { ok: mem.rss < 1.5 * 1024 * 1024 * 1024, rssMB: Math.round(mem.rss / 1048576) };

  // fontes externas (breaker aberto = fonte em cooldown, site segue com as outras)
  try {
    const { brokerStats } = await import("@/lib/broker");
    const stats = brokerStats();
    checks.externalSources = {
      ok: stats.every((s) => !s.breakerOpen),
      down: stats.filter((s) => s.breakerOpen).map((s) => s.label),
      requests: stats.reduce((acc, s) => acc + s.requests, 0),
      failures: stats.reduce((acc, s) => acc + s.failures, 0),
    };
  } catch {
    checks.externalSources = { ok: true };
  }

  const ok = checks.database.ok && checks.worksCache.ok;
  return NextResponse.json(
    { ok, status: ok ? "healthy" : "degraded", uptimeS: Math.round(process.uptime()), totalMs: Date.now() - started, checks, at: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
