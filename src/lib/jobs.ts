// Jobs de background do OtakuVerse — SÓ roda no runtime Node.js.
// Importado dinamicamente pelo instrumentation.ts dentro do guard NEXT_RUNTIME,
// então o bundler elimina este módulo do bundle Edge (nunca é parseado lá).
//
// Durabilidade em camadas (nada se perde):
//   1. backup SQLite diário (VACUUM INTO, rotação de 10, fora do git) + integrity_check
//   2. snapshot git-safe a cada 6h (catálogo + contas → data/, com sha256 verificado)
//   3. auto-commit dos snapshots no git (sobrevive a reset do ambiente)
//   4. auto-restore no boot se o banco foi perdido (count < 10k → restore do snapshot)
const g = globalThis as unknown as {
  __ovJobsStarted?: boolean;
  __ovLastBackupDay?: string;
  __ovLastSnapshotAt?: number;
  __ovRestoreChecked?: boolean;
};

const SNAP_INTERVAL = 6 * 60 * 60 * 1000; // 6h — um reset no pior caso perde <6h de dados

async function runScript(script: string, timeout: number): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)("npx", ["tsx", script], { cwd: process.cwd(), timeout });
  return stdout;
}

/** Auto-commit dos snapshots: cria commit SÓ com data/ se houver mudanças. Nunca
 *  toca em código, nunca faz push — é apenas o cofre que sobrevive a resets. */
async function gitCommitSnapshots() {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const run = (cmd: string, args: string[]) => promisify(execFile)(cmd, args, { cwd: process.cwd(), timeout: 30_000 });
    // garante identidade do git em ambientes limpos (não sobrescreve se já configurada)
    await run("git", ["config", "user.name"]).catch(async () => {
      await run("git", ["config", "user.name", "OtakuVerse Snapshot Bot"]).catch(() => {});
      await run("git", ["config", "user.email", "snapshot@otakuverse.local"]).catch(() => {});
    });
    await run("git", ["add", "data/"]);
    const { stdout: status } = await run("git", ["status", "--porcelain", "data/"]);
    if (!status.trim()) return; // nada mudou — sem commit vazio
    await run("git", ["commit", "-m", `data: auto-snapshot do catálogo e contas (${new Date().toISOString().slice(0, 16)})`]);
    console.log("[snapshot] commitado no git (cofre contra resets)");
  } catch (e) {
    console.error("[snapshot] auto-commit falhou (snapshot em disco continua válido):", (e as Error).message);
  }
}

/** Snapshot git-safe (catálogo + contas + manifest verificado) — a cada 6h. */
async function doSnapshot(reason = "6h") {
  if (Date.now() - (g.__ovLastSnapshotAt ?? 0) < SNAP_INTERVAL - 60_000) return;
  try {
    const out = await runScript("scripts/catalog-snapshot.ts", 300_000);
    g.__ovLastSnapshotAt = Date.now();
    console.log(`[snapshot ${reason}]`, out.split("\n").filter((l) => l.includes("✓")).slice(-2).join(" | "));
    await gitCommitSnapshots();
  } catch (e) {
    console.error(`[snapshot ${reason}] falhou (segue o baile):`, (e as Error).message);
  }
}

/** Backup diário do SQLite (VACUUM INTO + rotação) — o db-backup.ts também roda
 *  integrity_check do arquivo de backup. */
async function doBackup() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (g.__ovLastBackupDay === today) return;
    const out = await runScript("scripts/db-backup.ts", 120_000);
    g.__ovLastBackupDay = today;
    console.log("[backup]", out.split("\n").slice(-2).join(" | "));
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
    const fs = await import("node:fs");
    const hasSnapshot = fs.existsSync(process.cwd() + "/data/catalog-snapshot.jsonl.gz");
    if (!hasSnapshot) return;
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("npx", ["tsx", "-e", `import {PrismaClient} from "@prisma/client"; const db = new PrismaClient(); db.work.count().then(async (n) => { console.log("COUNT=" + n); await db.$disconnect(); });`], { cwd: process.cwd(), timeout: 60_000 });
    const count = Number(/COUNT=(\d+)/.exec(stdout)?.[1] ?? 0);
    if (count < 10_000) {
      console.log(`[restore] banco com ${count} obras — restaurando do snapshot git-safe…`);
      const { stdout: out2 } = await promisify(execFile)("npx", ["tsx", "scripts/catalog-restore.ts"], { cwd: process.cwd(), timeout: 600_000 });
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

  // 2) backup diário do SQLite (primeira passada 5 min após o boot, checa a cada 6h)
  setTimeout(doBackup, 5 * 60_000);
  setInterval(doBackup, 6 * 60 * 60_000);

  // 3) snapshot git-safe a cada 6h (primeira passada 20 min após o boot)
  //    + auto-commit → qualquer crescimento fica guardado no git, imune a reset.
  setTimeout(() => doSnapshot("boot"), 20 * 60_000);
  setInterval(() => doSnapshot("6h"), 6 * 60 * 60_000);
}
