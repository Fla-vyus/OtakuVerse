// Jobs de background do OtakuVerse — SÓ roda no runtime Node.js.
// Importado dinamicamente pelo instrumentation.ts dentro do guard NEXT_RUNTIME,
// então o bundler elimina este módulo do bundle Edge (nunca é parseado lá).
const g = globalThis as unknown as { __ovJobsStarted?: boolean; __ovLastBackupDay?: string };

async function doBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (g.__ovLastBackupDay === today) return;
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = promisify(execFile);
    await run("npx", ["tsx", "scripts/db-backup.ts"], { cwd: process.cwd(), timeout: 120_000 });
    g.__ovLastBackupDay = today;
    console.log("[backup] snapshot diário do banco concluído");
  } catch (e) {
    console.error("[backup] falhou (segue o baile):", (e as Error).message);
  }
}

export function startBackgroundJobs() {
  if (g.__ovJobsStarted) return;
  g.__ovJobsStarted = true;

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

  // 2) backup diário do SQLite (primeira passada 5 min após o boot, checa a cada 6h)
  setTimeout(doBackup, 5 * 60_000);
  setInterval(doBackup, 6 * 60 * 60_000);
}
