// Auto-update em background: roda refresh do catálogo a cada 30 min no servidor.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const g = globalThis as unknown as { __ovCronStarted?: boolean };
  if (g.__ovCronStarted) return;
  g.__ovCronStarted = true;
  setTimeout(() => {
    import("./src/app/api/cron/refresh/route")
      .then((m) => m.doRefresh())
      .catch(() => {});
  }, 90_000);
  setInterval(
    () => {
      import("./src/app/api/cron/refresh/route")
        .then((m) => m.doRefresh())
        .catch(() => {});
    },
    30 * 60_000
  );
}
