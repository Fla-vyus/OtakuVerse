// v3.9 — runtime-env primeiro: garante DATABASE_URL/AI_* do otakuverse.runtime.json
// antes de qualquer job/rota ler env (a plataforma não injeta variáveis).
import "./lib/runtime-env";

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
    process.on("uncaughtException", (err) => {
      console.error("[process] uncaughtException (servidor segue de pé):", err?.stack || err);
    });
    process.on("unhandledRejection", (reason) => {
      console.error("[process] unhandledRejection (servidor segue de pé):", reason instanceof Error ? reason.stack : reason);
    });
  }

  const { startBackgroundJobs } = await import("./lib/jobs");
  startBackgroundJobs();
}
