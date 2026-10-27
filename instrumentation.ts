// Auto-update em background: refresh do catálogo a cada 30 min + backup diário do DB.
// A lógica Node vive em src/lib/jobs.ts — o guard com NEXT_RUNTIME estático permite
// ao bundler eliminar o import do bundle Edge (instrumentation também é compilado para edge).
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __ovCronStarted?: boolean };
  if (g.__ovCronStarted) return;
  g.__ovCronStarted = true;
  const { startBackgroundJobs } = await import("./src/lib/jobs");
  startBackgroundJobs();
}
