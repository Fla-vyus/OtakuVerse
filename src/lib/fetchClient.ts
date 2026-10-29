// Cliente fetch com isolamento: timeout + retry com backoff + ÚLTIMA RESPOSTA BOA.
// v4.0 (ETAPA 6): se todas as tentativas falharem, devolve a última resposta boa
// guardada no sessionStorage — a tela nunca fica vazia com erro genérico enquanto
// houver conteúdo anterior. Guardas: só cacheia resposta com ok:true e < 300KB.
export async function fetchJSON<T = any>(url: string, opts?: { tries?: number; timeoutMs?: number; signal?: AbortSignal; noCache?: boolean }): Promise<T | null> {
  const tries = opts?.tries ?? 3;
  const timeoutMs = opts?.timeoutMs ?? 15_000;
  const cacheKey = `ov:lastgood:${url}`;

  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      // propaga abort externo (troca de view) para esta tentativa
      const onAbort = () => ctrl.abort();
      opts?.signal?.addEventListener("abort", onAbort, { once: true });
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as T;
        if (!opts?.noCache) {
          try {
            const raw = JSON.stringify(data);
            if (raw.length < 300_000 && (data as any)?.ok !== false) sessionStorage.setItem(cacheKey, raw);
          } catch { /* quota cheia — segue sem cache */ }
        }
        return data;
      } finally {
        clearTimeout(timer);
        opts?.signal?.removeEventListener("abort", onAbort);
      }
    } catch (e: any) {
      // abort externo (usuário saiu da view) → sem retry, sem cache
      if (opts?.signal?.aborted) return null;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }

  // esgotou: última resposta boa desta rota (mesmo velha) > tela vazia
  if (!opts?.noCache) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) return JSON.parse(raw) as T;
    } catch {}
  }
  return null;
}

/** Lê a última resposta boa guardada para uma URL (sem rede). */
export function lastGood<T = any>(url: string): T | null {
  try {
    const raw = sessionStorage.getItem(`ov:lastgood:${url}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
