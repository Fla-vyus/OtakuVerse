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

/** Guarda de memória: jobs pesados (snapshot/vault/backup) são filhos node de
 *  centenas de MB — se o servidor já está acima do limiar, ADIA o job para o
 *  próximo ciclo em vez de disputar RAM e ser morto pelo OOM (site cai). */
async function memOk(limitMB = 1400): Promise<boolean> {
  const mem = process.memoryUsage();
  const rss = Math.round(mem.rss / 1048576);
  if (rss > limitMB) {
    console.warn(`[jobs] memória ${rss}MB > ${limitMB}MB — job pesado adiado para o próximo ciclo`);
    return false;
  }
  return true;
}

/** Snapshot git-safe (catálogo + contas + manifest verificado) — a cada 6h. */
async function doSnapshot(reason = "6h") {
  if (Date.now() - (g.__ovLastSnapshotAt ?? 0) < SNAP_INTERVAL - 60_000) return;
  if (!(await memOk())) return;
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
    if (!(await memOk())) return;
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

/** Cofre EXTERNO (/home/z/otakuverse-vault): o mesmo banco em vários formatos
 *  (.db, .sql, .jsonl, .csv) em um lugar fora do projeto — sobrevive mesmo se o
 *  diretório inteiro do site for apagado. Roda após o snapshot git-safe. */
async function doVault(reason = "6h") {
  try {
    if (!(await memOk())) return;
    const out = await runScript("scripts/vault-sync.ts", 600_000);
    console.log(`[vault ${reason}]`, out.split("\n").filter((l) => l.startsWith("  ✓") || l.includes("COFRE")).slice(-3).join(" | "));
  } catch (e) {
    console.error(`[vault ${reason}] falhou (snapshot git-safe continua válido):`, (e as Error).message);
  }
}

/** Watchdog: auto-diagnóstico a cada 5 min — o site NUNCA fica quebrado em
 *  silêncio. Checa: banco responde, pool de obras vivo, memória sob controle,
 *  imagem-cache não estourou. Problemas aparecem no log com [watchdog]. */
async function watchdog() {
  try {
    const t0 = Date.now();
    const prisma = (await import("@/lib/db")).db;
    await prisma.$queryRawUnsafe("SELECT 1");
    const dbMs = Date.now() - t0;
    const works = (await import("@/lib/works")).peekStaleCache()?.works.length ?? 0;
    const mem = process.memoryUsage();
    const rssMB = Math.round(mem.rss / 1048576);
    const issues: string[] = [];
    if (dbMs > 2000) issues.push(`banco lento (${dbMs}ms)`);
    if (works === 0) issues.push("pool de obras vazio (banco perdido ou boot frio?)");
    if (rssMB > 1500) issues.push(`memória CRÍTICA (${rssMB}MB — OOM da box é 1.9GB, considere reiniciar)`);
    else if (rssMB > 1100) issues.push(`memória alta (${rssMB}MB)`);
    if (issues.length) console.warn(`[watchdog] atenção: ${issues.join(" · ")}`);
    else console.log(`[watchdog] ok — banco ${dbMs}ms, pool ${works} obras, rss ${rssMB}MB`);
  } catch (e) {
    console.error("[watchdog] BANCO NÃO RESPONDE:", (e as Error).message);
  }
}

/** Warm-up de rotas: logo após o boot, o próprio servidor "se visita" para
 *  compilar página + rotas de API ANTES do primeiro usuário chegar. Em dev,
 *  cada rota compila sob demanda (segundos na 1ª visita) — aqui isso acontece
 *  em background nos primeiros segundos, então abrir o site nunca pega a
 *  compilação fria. Sequencial e tolerante a falhas: warm-up nunca derruba nada. */
async function warmUpRoutes() {
  const base = `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  // espera o servidor aceitar conexões (max ~40s)
  for (let i = 0; i < 20; i++) {
    try {
      const r = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (r.ok) break;
    } catch {}
    await new Promise((res) => setTimeout(res, 2000));
  }
  // GETs que o cliente usa de verdade — compila rota + aquece cache dos dados
  const routes = [
    "/", // página única (SPA de hash)
    "/api/sections", "/api/hype", "/api/news", "/api/feed", "/api/sales", "/api/magazines",
    "/api/streaming", "/api/schedule", "/api/status",
    "/api/works?sort=popular&perPage=60", "/api/works/1", // detail: compila o route handler
  ];
  for (const r of routes) {
    try {
      const t0 = Date.now();
      const res = await fetch(`${base}${r}`, { signal: AbortSignal.timeout(30_000) });
      // lê o corpo para garantir que a resposta terminou de ser produzida
      await res.arrayBuffer().catch(() => {});
      console.log(`[warmup] ${r} → ${res.status} (${Date.now() - t0}ms)`);
    } catch (e) {
      console.warn(`[warmup] ${r} falhou (segue o baile):`, (e as Error).message);
    }
    await new Promise((res) => setTimeout(res, 150)); // não sufoca o servidor
  }
  console.log("[warmup] concluído — todas as rotas quentes para o primeiro visitante");
}

export function startBackgroundJobs() {
  if (g.__ovJobsStarted) return;
  g.__ovJobsStarted = true;

  // 0) restore automático se o banco foi perdido (roda antes do primeiro cron)
  setTimeout(autoRestore, 10_000);

  // 0.5) warm-up de rotas: página + APIs compiladas e quentes ANTES do 1º usuário
  //      (atraso curto: deixa o restore/primeiro rebuild do pool começar primeiro)
  setTimeout(warmUpRoutes, 4_000);

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
  //    Na sequência, o cofre externo replica tudo em vários formatos fora do site.
  const snapshotCycle = () => doSnapshot("6h").then(() => doVault("6h")).catch(() => {});
  setTimeout(snapshotCycle, 20 * 60_000);
  setInterval(snapshotCycle, 6 * 60 * 60_000);

  // 4) watchdog: auto-diagnóstico a cada 5 min (primeira passada 1 min após o boot)
  setTimeout(watchdog, 60_000);
  setInterval(watchdog, 5 * 60_000);

  // 5) ingestão do Feed Social (Reddit + Kitsu) a cada 6h — leve, mas com guarda de
  //    memória igual aos jobs pesados; primeira passada 3 min após o boot.
  const doFeed = () => {
    memOk(1100).then((ok) => {
      if (!ok) return;
      runScript("scripts/feed-ingest.ts", 240_000).then((out) => {
        const line = out.split("\n").find((l) => l.includes("ingestão concluída"));
        if (line) console.log("[feed]", line.trim());
      }).catch((e) => console.warn("[feed] ingestão falhou (tenta de novo no próximo ciclo):", (e as Error).message));
    });
  };
  setTimeout(doFeed, 3 * 60_000);
  setInterval(doFeed, 6 * 60 * 60_000);
}
