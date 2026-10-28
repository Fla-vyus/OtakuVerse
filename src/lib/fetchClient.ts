// Cliente fetch com isolamento: timeout + retry com backoff.
// Usado pelas views principais — rede instável nunca deixa a página em spinner infinito.
export async function fetchJSON<T = any>(url: string, opts?: { tries?: number; timeoutMs?: number }): Promise<T | null> {
  const tries = opts?.tries ?? 3;
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch {
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  return null;
}
