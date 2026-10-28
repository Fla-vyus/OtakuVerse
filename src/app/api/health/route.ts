// Health check do OtakuVerse — para monitoramento (watchdog interno, uptime externo).
// Retorna rápido e SEMPRE 200 com o estado de cada componente (nunca derruba o monitor).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { peekStaleCache } from "@/lib/works";
import { existsSync } from "node:fs";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const checks: Record<string, any> = {};

  // banco
  try {
    const t0 = Date.now();
    await db.$queryRawUnsafe("SELECT 1");
    checks.database = { ok: true, ms: Date.now() - t0 };
  } catch (e: any) {
    checks.database = { ok: false, error: String(e?.message ?? e).slice(0, 120) };
  }

  // pool de obras (cache quente = site navegável mesmo com banco sob pressão)
  const pool = peekStaleCache();
  checks.worksCache = { ok: (pool?.works.length ?? 0) > 0, size: pool?.works.length ?? 0 };

  // durabilidade em disco
  try {
    const hasBackup = existsSync(process.cwd() + "/db/backups");
    const hasSnapshot = existsSync(process.cwd() + "/data/catalog-snapshot.jsonl.gz");
    const hasVault = existsSync("/home/z/otakuverse-vault/latest/manifesto.json");
    checks.durability = { ok: hasBackup && hasSnapshot, backup: hasBackup, snapshotGitSafe: hasSnapshot, vaultExterno: hasVault };
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
