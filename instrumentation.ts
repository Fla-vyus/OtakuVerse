// ⚠️ SINCRONIZADO com src/instrumentation.ts — o Next pode resolver ESTE arquivo
// (raiz) em vez do de src/ dependendo da versão/resolução. Qualquer mudança aqui
// DEVE ser espelhada lá (e vice-versa), ajustando só os caminhos relativos.
// v3.9 — runtime-env primeiro: garante DATABASE_URL/AI_* do otakuverse.runtime.json
// antes de qualquer job/rota ler env (a plataforma não injeta variáveis).
import "./src/lib/runtime-env";
import { isRemoteDb } from "./src/lib/runtime-env";

// Auto-update em background: refresh do catálogo a cada 30 min + backup diário do DB.
// A lógica Node vive em src/lib/jobs.ts — o guard com NEXT_RUNTIME estático permite
// ao bundler eliminar o import do bundle Edge (instrumentation também é compilado para edge).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __ovCronStarted?: boolean; __ovProcGuards?: boolean };
  if (g.__ovCronStarted) return;
  g.__ovCronStarted = true;

  // Blindagem de processo: exceções/rejections não tratadas não podem derrubar o
  // site em silêncio. Logamos com stack e SEGUIMOS servindo — o keepalive daemon
  // (scripts/keepalive.sh) + watchdog de memória cuidam do caminho de reinício.
  // Sem isso, uma promise perdida num job de fundo derruba o servidor inteiro.
  if (!g.__ovProcGuards) {
    g.__ovProcGuards = true;
    // v3.9.4 — gravador de voo: o rastro em disco sobrevive ao processo
    const { flight } = await import("./src/lib/flightlog");
    const rssMB = () => Math.round((process.memoryUsage?.().rss ?? 0) / 1048576);
    flight("boot", { rssMB: rssMB(), node: process.version, remote: isRemoteDb, poolMax: process.env.OTAKUVERSE_POOL_MAX ?? "" });
    process.on("uncaughtException", (err) => {
      console.error("[process] uncaughtException (servidor segue de pé):", err?.stack || err);
      flight("uncaughtException", { msg: String(err?.message ?? err).slice(0, 200), rssMB: rssMB() });
    });
    process.on("unhandledRejection", (reason) => {
      console.error("[process] unhandledRejection (servidor segue de pé):", reason instanceof Error ? reason.stack : reason);
      flight("unhandledRejection", { msg: String(reason instanceof Error ? reason.message : reason).slice(0, 200), rssMB: rssMB() });
    });
    for (const sig of ["SIGTERM", "SIGINT"] as const) {
      process.on(sig, () => {
        flight("signal", { sig, rssMB: rssMB() });
      });
    }
  }

  const { startBackgroundJobs } = await import("./src/lib/jobs");
  startBackgroundJobs();
}
