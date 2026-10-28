// Jobs de background do OtakuVerse — SÓ roda no runtime Node.js.
// Importado dinamicamente pelo instrumentation.ts dentro do guard NEXT_RUNTIME,
// então o bundler elimina este módulo do bundle Edge (nunca é parseado lá).
import { existsSync } from "node:fs";
import { resolve } from "node:path";
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
  __ovWatchdogHealedAt?: number;
};

const SNAP_INTERVAL = 6 * 60 * 60 * 1000; // 6h — um reset no pior caso perde <6h de dados

// BLINDAGEM v3.7.2 — raiz do projeto via ENV determinística. Histórico da caça:
//   v3.6: detecção por scripts/db-backup.ts → enganada (o turbopack file tracing
//         copia scripts referenciados por string para .next/standalone);
//   v3.7.1: detecção por prisma/schema.prisma → o código compilado está correto no
//         chunk, POREM dentro do servidor em execução o existsSync do import
//         estático se comporta de forma não confiável e a detecção ainda cai no
//         cwd (comprovado: snapshot gravou em .next/standalone/data às 18:54).
//   v3.7.2: deploy.sh/keepalive.sh EXPORTAM OTAKUVERSE_ROOT (raiz real). A função
//         usa a env primeiro; a detecção por prisma/ fica só como fallback. E o
//         caminho do script é sempre ABSOLUTO — acabou a ambiguidade de resolução.
function projectRoot(): string {
  const envRoot = process.env.OTAKUVERSE_ROOT ?? "";
  if (envRoot && existsSync(`${envRoot}/prisma/schema.prisma`)) return envRoot;
  const cwd = process.cwd();
  if (existsSync(`${cwd}/prisma/schema.prisma`)) return cwd;
  const up = resolve(cwd, "..", "..");
  if (existsSync(`${up}/prisma/schema.prisma`)) return up;
  let cur = cwd;
  for (let i = 0; i < 4; i++) {
    cur = resolve(cur, "..");
    if (existsSync(`${cur}/prisma/schema.prisma`)) return cur;
  }
  return cwd;
}

async function runScript(script: string, timeout: number): Promise<string> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const root = projectRoot();
  // v3.7.4: node 24 roda TS nativamente — ZERO dependência de tsx/npx (o npx baixa
  // da rede e MORRE em ambientes de deploy sem registro npm — comprovado no sim)
  const { stdout } = await promisify(execFile)(process.execPath, [`${root}/${script}`], { cwd: root, timeout });
  return stdout;
}

/** Auto-commit dos snapshots: cria commit SÓ com data/ se houver mudanças. Nunca
 *  toca em código, nunca faz push — é apenas o cofre que sobrevive a resets. */
async function gitCommitSnapshots() {
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const root = projectRoot(); // o repositório git está na raiz, NUNCA no standalone
    const run = (cmd: string, args: string[]) => promisify(execFile)(cmd, args, { cwd: root, timeout: 30_000 });
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
    const root = projectRoot();
    const hasSnapshot = fs.existsSync(`${root}/data/catalog-snapshot.jsonl.gz`);
    if (!hasSnapshot) return;
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)(process.execPath, ["-e", `const {PrismaClient} = require("@prisma/client"); const db = new PrismaClient(); db.work.count().then(async (n) => { console.log("COUNT=" + n); await db.$disconnect(); });`], { cwd: root, timeout: 60_000 });
    const count = Number(/COUNT=(\d+)/.exec(stdout)?.[1] ?? 0);
    // Marca d'água: o manifest guarda a última contagem boa conhecida do snapshot.
    // O limiar fixo de 10k deixava passar perda PARCIAL (ex.: 37.574 → 24.807 passava
    // batido e o site ficava ralo sem ninguém perceber). Agora qualquer queda ≥ 10%
    // contra o último snapshot bom dispara restore aditivo.
    let expected = 0;
    try {
      const manifest = JSON.parse(fs.readFileSync(`${root}/data/manifest.json`, "utf8"));
      expected = Number(manifest.catalog?.count ?? 0);
    } catch {}
    const floor = expected > 10_000 ? Math.floor(expected * 0.9) : 10_000;
    if (count < floor) {
      console.log(`[restore] banco com ${count} obras (esperado ≥ ${floor}) — restaurando do snapshot git-safe…`);
      const { stdout: out2 } = await promisify(execFile)(process.execPath, [`${root}/scripts/catalog-restore.ts`, "--force"], { cwd: root, timeout: 600_000 });
      console.log("[restore]", out2.split("\n").slice(-3).join(" | "));
      // v3.7.4: o pool em memória fica preso no estado pós-boot (poucas obras) — o
      // watchdog só cura pool VAZIO (0). Após restore, reconstrói o pool NA HORA,
      // senão o site fresco fica com ~14 obras por 15min (TTL) — comprovado no sim.
      const worksMod = await import("@/lib/works");
      worksMod.forceRebuild()
        .then((c) => console.log(`[restore] pool reconstruído: ${c.works.length} obras`))
        .catch((e) => console.error("[restore] rebuild pós-restore falhou:", (e as Error).message));
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
 *  imagem-cache não estourou. Problemas aparecem no log com [watchdog].
 *  v3.6 — CURA ATIVA: pool vazio com banco saudável deixa de ser só um log —
 *  o watchdog dispara o rebuild na hora (foi exatamente o incidente de hoje:
 *  tick do cron invalidou o pool às 17:55 e o site passou ~1h "sem catálogo"
 *  porque ninguém acessou nada até alguém reaquecer à mão). */
async function watchdog() {
  try {
    const t0 = Date.now();
    const prisma = (await import("@/lib/db")).db;
    await prisma.$queryRawUnsafe("SELECT 1");
    const dbMs = Date.now() - t0;
    const worksMod = await import("@/lib/works");
    const works = worksMod.peekStaleCache()?.works.length ?? 0;
    const mem = process.memoryUsage();
    const rssMB = Math.round(mem.rss / 1048576);
    const issues: string[] = [];
    if (dbMs > 2000) issues.push(`banco lento (${dbMs}ms)`);
    if (works === 0) issues.push("pool de obras vazio (banco perdido ou boot frio?)");
    if (rssMB > 1500) issues.push(`memória CRÍTICA (${rssMB}MB — OOM da box é 1.9GB, considere reiniciar)`);
    else if (rssMB > 1100) issues.push(`memória alta (${rssMB}MB)`);
    if (issues.length) console.warn(`[watchdog] atenção: ${issues.join(" · ")}`);
    else console.log(`[watchdog] ok — banco ${dbMs}ms, pool ${works} obras, rss ${rssMB}MB`);
    // cura ativa: banco responde rápido + pool vazio/quase vazio → reconstrói agora
    // (v3.7.4: <500 em vez de ===0 — boot frio pós-restore começa com poucas obras
    // e ficava "saudável" com catálogo ralo; 40k obras é o estado legítimo deste site)
    if (works < 500 && dbMs < 2000) {
      const now = Date.now();
      if (now - (g.__ovWatchdogHealedAt ?? 0) > 5 * 60_000) {
        g.__ovWatchdogHealedAt = now;
        console.warn("[watchdog] CURA ATIVA: disparando rebuild do pool…");
        worksMod.forceRebuild()
          .then((c) => console.log(`[watchdog] pool restaurado: ${c.works.length} obras`))
          .catch((e) => console.error("[watchdog] rebuild de cura falhou:", (e as Error).message));
      }
    }
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
  // GETs que o cliente usa de verdade — compila rota + aquece cache dos dados.
  // A home em fases (v3.5) usa part=core e part=more — as duas são aquecidas.
  const routes = [
    "/", // página única (SPA de hash)
    "/api/sections?part=core", "/api/sections?part=more", "/api/hype", "/api/news", "/api/sales", "/api/magazines",
    "/api/streaming", "/api/schedule", "/api/status",
    "/api/works?sort=popular&perPage=60", "/api/works?type=webnovel&sort=popular&perPage=60", "/api/works/1", // detail: compila o route handler
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

  // 5) backfill de capas — ~18.5k obras ficaram sem capa em um backfill antigo
  //    (a AniList tem as imagens). Idempotente: quando o catálogo está completo,
  //    a passada termina em segundos ("nada a fazer"). Diário e com guarda de memória.
  const doCoverBackfill = () => {
    memOk(1450).then((ok) => {
      if (!ok) return;
      runScript("scripts/cover-backfill.ts", 8 * 60_000).then((out) => {
        const line = out.split("\n").find((l) => l.includes("backfill de capas") || l.includes("nada a fazer"));
        if (line) console.log("[capas]", line.trim());
      }).catch((e) => console.warn("[capas] backfill falhou (tenta no próximo ciclo):", (e as Error).message));
    });
  };
  setTimeout(doCoverBackfill, 2.5 * 60_000);
  setInterval(doCoverBackfill, 24 * 60 * 60_000);

  // 6) TOPUP diário de webnovels (MangaUpdates, gratuito): pega títulos novos (create-only)
  //    + enriquece 150 webnovels ainda sem status/autores. Idempotente e com guarda de memória.
  const doWebnovelTopup = () => {
    memOk(1450).then((ok) => {
      if (!ok) return;
      runScript("scripts/seed-webnovels.ts --topup", 9 * 60_000)
        .then((out) => {
          const line = out.split("\n").find((l) => l.includes("TOPUP OK"));
          if (line) console.log("[webnovels]", line.trim());
        })
        .catch((e) => console.warn("[webnovels] topup falhou (tenta amanhã):", (e as Error).message));
    });
  };
  setTimeout(doWebnovelTopup, 40 * 60_000);
  setInterval(doWebnovelTopup, 24 * 60 * 60_000);

  // NOTA: o ingest do Feed Social (Reddit/Kitsu) foi DESATIVADO junto com a aba
  // "Feed ao vivo" (removida a pedido do usuário — não entregou o valor esperado).
  // Os posts existentes continuam no banco (FeedPost) e o script scripts/feed-ingest.ts
  // segue disponível para reativação manual se um dia a aba voltar.
}
