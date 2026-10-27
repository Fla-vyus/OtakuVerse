// Jobs de background do OtakuVerse — SÓ roda no runtime Node.js.
// Importado dinamicamente pelo instrumentation.ts dentro do guard NEXT_RUNTIME,
// então o bundler elimina este módulo do bundle Edge (nunca é parseado lá).
const g = globalThis as unknown as { __ovJobsStarted?: boolean; __ovLastBackupDay?: string; __ovRestoreChecked?: boolean };

async function doBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (g.__ovLastBackupDay === today) return;
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    await run("npx", ["tsx", "scripts/db-backup.ts"], { cwd: process.cwd(), timeout: 120_000 });
    // snapshot git-safe diário (catálogo + contas → data/, sobrevive a reset do ambiente quando commitado)
    await run("npx", ["tsx", "scripts/catalog-snapshot.ts"], { cwd: process.cwd(), timeout: 300_000 }).catch(() => {});
    g.__ovLastBackupDay = today;
    console.log("[backup] snapshot diário do banco concluído");
  } catch (e) {
    console.error("[backup] falhou (segue o baile):", (e as Error).message);
  }
}

/** Restore automático: se o banco foi perdido (reset do ambiente) e existe snapshot
 *  git-safe, recupera catálogo + contas no boot — antes do primeiro cron. */
async function autoRestore() {
  if (g.__ovRestoreChecked) return;
  g.__ovRestoreChecked = true;
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const fs = await import("node:fs");
    const hasSnapshot = fs.existsSync(process.cwd() + "/data/catalog-snapshot.jsonl.gz");
    if (!hasSnapshot) return;
    const run = promisify(execFile);
    const { stdout } = await run("npx", ["tsx", "-e", `import {PrismaClient} from "@prisma/client"; const db = new PrismaClient(); db.work.count().then(async (n) => { console.log("COUNT=" + n); await db.$disconnect(); });`], { cwd: process.cwd(), timeout: 60_000 });
    const count = Number(/COUNT=(\d+)/.exec(stdout)?.[1] ?? 0);
    if (count < 10_000) {
      console.log(`[restore] banco com ${count} obras — restaurando do snapshot git-safe…`);
      const { stdout: out2 } = await run("npx", ["tsx", "scripts/catalog-restore.ts"], { cwd: process.cwd(), timeout: 600_000 });
      console.log("[restore]", out2.split("\n").slice(-3).join(" | "));
    }
  } catch (e) {
    console.error("[restore] falhou (segue o baile):", (e as Error).message);
  }
}

export function startBackgroundJobs() {
  if (g.__ovJobsStarted) return;
  g.__ovJobsStarted = true;

  // 0) restore automático se o banco foi perdido (roda antes do primeiro cron)
  setTimeout(autoRestore, 10_000);

  // 1) refresh do catálogo a cada 30 min (primeira passada 90s após o boot)
  setTimeout(() => {
    import("@/app/api/cron/refresh/route")
      .then((m) => m.doRefresh())
      .catch(() => {});
  }, 90_000);
  setInterval(() => {
    import("@/app/api/cron/refresh/route")
      .then((m) => m.doRefresh())
      .catch(() => {});
  }, 30 * 60_000);

  // 2) backup diário do SQLite + snapshot git-safe (primeira passada 5 min após o boot, checa a cada 6h)
  setTimeout(doBackup, 5 * 60_000);
  setInterval(doBackup, 6 * 60 * 60_000);
}
