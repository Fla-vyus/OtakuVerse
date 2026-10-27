// Cache client de respostas GET — evita refetch ao navegar entre views
// (performance: trocar de view/página é instantâneo quando os dados são recentes).

interface Entry {
  at: number;
  data: any;
}

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<any>>();

export function cachedFetchJson(url: string, ttlMs = 45_000): Promise<any> {
  const hit = store.get(url);
  if (hit && Date.now() - hit.at < ttlMs) return Promise.resolve(hit.data);

  const running = inflight.get(url);
  if (running) return running;

  const task = fetch(url)
    .then((r) => r.json())
    .then((d) => {
      store.set(url, { at: Date.now(), data: d });
      // poda simples: mantém o cache enxuto
      if (store.size > 120) {
        const oldest = [...store.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 40);
        for (const [k] of oldest) store.delete(k);
      }
      return d;
    })
    .finally(() => inflight.delete(url));

  inflight.set(url, task);
  return task;
}

/** Invalida entradas que começam com o prefixo (ex.: após salvar na prateleira) */
export function invalidatePrefix(prefix: string) {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
