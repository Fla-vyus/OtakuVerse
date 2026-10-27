// Broker de requisições externas — distribui e protege o acesso às fontes reais.
//
// Problema: APIs externas (AniList, MangaDex, Kitsu…) bloqueiam clientes que
// fazem muitas requisições seguidas ou ignoram rate limits. Quando isso acontecia,
// sincronizações falhavam em silêncio e o catálogo deixava de crescer.
//
// Solução: TODO acesso externo passa por este broker, que garante:
//  1. Token bucket por fonte — cada fonte tem seu próprio ritmo (nunca "metralha" uma só);
//  2. Concorrência limitada por fonte (máx. requisições simultâneas);
//  3. Circuit breaker — fonte falhando repetidamente entra em cooldown e o resto
//     do site continua funcionando com as outras fontes;
//  4. Retry com backoff exponencial + jitter, respeitando "Retry-After" em 429;
//  5. Coalescing — requisições GET idênticas em andamento compartilham a mesma
//     resposta (evita duplicar trabalho quando duas views pedem o mesmo recurso);
//  6. Métricas por fonte (para o rodapé/painel de saúde).
//
// Papéis das fontes (cada uma faz UMA coisa, distribuição de carga):
//   anilist      → metadados mestres de anime/mangá/LN (sync + descoberta)
//   mangadex     → capítulos, idiomas reais, capas alternativas
//   kitsu        → complemento de capas/dados de anime
//   tvmaze       → doramas (emissora, episódios, pôsteres)
//   mangaupdates → enriquecimento editorial de mangás (rank, ano, capa extra)
//   malrss       → notícias (RSS oficial do MyAnimeList)

export type SourceKey = "anilist" | "mangadex" | "kitsu" | "tvmaze" | "mangaupdates" | "malrss";

interface SourcePolicy {
  label: string;
  minIntervalMs: number; // espaço mínimo entre requisições
  maxConcurrent: number;
  maxRetries: number; // tentativas extras em 429/5xx
  baseBackoffMs: number;
  failureThreshold: number; // falhas seguidas antes de abrir o breaker
  cooldownMs: number; // tempo de breaker aberto
}

export const POLICIES: Record<SourceKey, SourcePolicy> = {
  anilist: { label: "AniList", minIntervalMs: 2200, maxConcurrent: 2, maxRetries: 3, baseBackoffMs: 2500, failureThreshold: 4, cooldownMs: 45_000 },
  mangadex: { label: "MangaDex", minIntervalMs: 1150, maxConcurrent: 2, maxRetries: 4, baseBackoffMs: 2000, failureThreshold: 5, cooldownMs: 30_000 },
  kitsu: { label: "Kitsu", minIntervalMs: 1250, maxConcurrent: 2, maxRetries: 3, baseBackoffMs: 2000, failureThreshold: 4, cooldownMs: 30_000 },
  tvmaze: { label: "TVMaze", minIntervalMs: 400, maxConcurrent: 2, maxRetries: 3, baseBackoffMs: 1500, failureThreshold: 5, cooldownMs: 20_000 },
  mangaupdates: { label: "MangaUpdates", minIntervalMs: 1600, maxConcurrent: 2, maxRetries: 3, baseBackoffMs: 2000, failureThreshold: 4, cooldownMs: 30_000 },
  malrss: { label: "MAL News", minIntervalMs: 1200, maxConcurrent: 1, maxRetries: 2, baseBackoffMs: 3000, failureThreshold: 3, cooldownMs: 20_000 },
};

interface SourceState {
  lastStart: number;
  inFlight: number;
  queue: (() => void)[]; // waiters esperando a vez
  failures: number; // falhas consecutivas
  openUntil: number; // breaker aberto até este timestamp
  metrics: { requests: number; retries: number; failures: number; lastError: string | null; lastErrorAt: number; lastLatencyMs: number };
}

const state = new Map<SourceKey, SourceState>();
const inflightGets = new Map<string, Promise<Response>>(); // coalescing de GETs idênticos

function srcState(k: SourceKey): SourceState {
  let s = state.get(k);
  if (!s) {
    s = { lastStart: 0, inFlight: 0, queue: [], failures: 0, openUntil: 0, metrics: { requests: 0, retries: 0, failures: 0, lastError: null, lastErrorAt: 0, lastLatencyMs: 0 } };
    state.set(k, s);
  }
  return s;
}

function jitter(ms: number): number {
  return Math.round(ms * (0.85 + Math.random() * 0.3)); // ±15%
}

/** Reserva um "turno" na fila da fonte (respeita intervalo mínimo e concorrência) */
async function acquire(k: SourceKey): Promise<void> {
  const s = srcState(k);
  const p = POLICIES[k];
  return new Promise((resolve) => {
    const tryStart = () => {
      const now = Date.now();
      if (s.inFlight >= p.maxConcurrent) return false;
      const wait = s.lastStart + p.minIntervalMs - now;
      if (wait > 0) {
        setTimeout(tryStart, jitter(wait));
        return true; // agendado
      }
      s.lastStart = now;
      s.inFlight++;
      resolve();
      return true;
    };
    if (!tryStart()) s.queue.push(() => tryStart());
  });
}

function release(k: SourceKey) {
  const s = srcState(k);
  s.inFlight--;
  const next = s.queue.shift();
  if (next) next();
}

export function breakerOpen(k: SourceKey): boolean {
  return srcState(k).openUntil > Date.now();
}

export interface BrokerResult<T> {
  data: T | null;
  error: string | null;
  sourceDown: boolean; // true = circuit breaker aberto (use outra fonte)
}

/**
 * Executa um fetch em nome de uma fonte, com fila, retry, backoff e breaker.
 * `run` deve devolver o Response real (o broker só decide WHEN e RETRY).
 */
export async function brokerFetch(
  source: SourceKey,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<BrokerResult<Response>> {
  const p = POLICIES[source];
  const s = srcState(source);

  // coalescing: GET idêntico em andamento reaproveita a resposta
  const isGet = (init.method ?? "GET") === "GET";
  if (isGet && !breakerOpen(source)) {
    const existing = inflightGets.get(url);
    if (existing) {
      try {
        return { data: await existing, error: null, sourceDown: false };
      } catch (e: any) {
        return { data: null, error: e.message, sourceDown: false };
      }
    }
  }

  const exec = (async (): Promise<Response> => {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= p.maxRetries; attempt++) {
      if (breakerOpen(source)) throw new Error(`${p.label} em cooldown (breaker aberto)`);
      await acquire(source);
      const t0 = Date.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 20_000);
        const res = await fetch(url, {
          ...init,
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timer);
        s.metrics.requests++;
        s.metrics.lastLatencyMs = Date.now() - t0;

        if (res.status === 429 || res.status >= 500) {
          // respeita Retry-After explicito, senão backoff exponencial com jitter
          const ra = Number(res.headers.get("retry-after"));
          const backoff = ra > 0 ? ra * 1000 : jitter(p.baseBackoffMs * Math.pow(2, attempt));
          s.metrics.retries++;
          if (attempt < p.maxRetries) {
            release(source);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          throw new Error(`${p.label} ${res.status} após ${p.maxRetries + 1} tentativas`);
        }

        s.failures = 0;
        return res;
      } catch (e: any) {
        lastErr = e;
        s.metrics.requests++;
        s.metrics.failures++;
        s.metrics.lastError = String(e.message ?? e);
        s.metrics.lastErrorAt = Date.now();
        // abort/timeout NÃO conta como falha de circuito (rede instável é comum)
        const isAbort = e.name === "AbortError" || /abort/i.test(String(e.message));
        if (!isAbort) s.failures++;
        if (s.failures >= p.failureThreshold) {
          s.openUntil = Date.now() + p.cooldownMs;
          s.failures = 0;
        }
        if (attempt >= p.maxRetries) break;
        await new Promise((r) => setTimeout(r, jitter(p.baseBackoffMs * Math.pow(2, attempt))));
      } finally {
        release(source);
      }
    }
    throw lastErr ?? new Error(`${p.label} falhou`);
  })();

  if (isGet) {
    inflightGets.set(url, exec);
    exec.finally(() => inflightGets.delete(url)).catch(() => {});
  }

  try {
    return { data: await exec, error: null, sourceDown: false };
  } catch (e: any) {
    const down = breakerOpen(source);
    return { data: null, error: String(e.message ?? e), sourceDown: down };
  }
}

/** JSON helper — devolve parsed ou null (com log de erro da fonte) */
export async function brokerJson<T = any>(
  source: SourceKey,
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<T | null> {
  const r = await brokerFetch(source, url, init);
  if (!r.data) return null;
  try {
    return (await r.data.json()) as T;
  } catch {
    return null;
  }
}

/** Painel de saúde das fontes (usado no rodapé/admin) */
export function brokerStats() {
  return (Object.keys(POLICIES) as SourceKey[]).map((k) => {
    const s = srcState(k);
    return {
      source: k,
      label: POLICIES[k].label,
      requests: s.metrics.requests,
      retries: s.metrics.retries,
      failures: s.metrics.failures,
      breakerOpen: breakerOpen(k),
      lastLatencyMs: s.metrics.lastLatencyMs,
      lastError: s.metrics.lastError,
    };
  });
}
