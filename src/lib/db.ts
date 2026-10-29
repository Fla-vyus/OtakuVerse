// v3.9 — runtime-env DEVE ser o primeiro import: injeta DATABASE_URL/TURSO_AUTH_TOKEN
// (e demais chaves) de otakuverse.runtime.json ANTES de isLibsqlMode ser avaliado.
import "./runtime-env";
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient as createLibsqlClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __ovDbMode?: 'file' | 'libsql'
  __ovDbSlots?: { active: number; queue: (() => void)[] }
}

/**
 * Modo duplo do banco:
 *  - file:    SQLite local (sandbox/dev) — WAL + PRAGMAs de isolamento como sempre.
 *  - libsql:  Turso (produção) — driver adapter, sem engine binária no bundle.
 *
 * Detecção pelo PREFIXO da DATABASE_URL: libsql:// / wss:// / https:// = remoto.
 */
export const isLibsqlMode = /^(libsql|wss|https):\/\//i.test(process.env.DATABASE_URL ?? '')

// ---------------------------------------------------------------------------
// v4.0 — ETAPA 5: CONFIABILIDADE DE BANCO (produção em container apertado).
// Toda consulta passa por: SEMÁFORO (5 simultâneas, fila máx. 200) + TIMEOUT 4s
// + 1 retry para erros transitórios de rede. Sem isso, um banco lento derruba o
// container inteiro (fila de conexões crescendo) ou pendura rotas por minutos.
// ---------------------------------------------------------------------------
const DB_CONCURRENCY = 5;
const DB_QUEUE_MAX = 200;
const DB_TIMEOUT_MS = 4_000;

function slots() {
  if (!globalForPrisma.__ovDbSlots) globalForPrisma.__ovDbSlots = { active: 0, queue: [] };
  return globalForPrisma.__ovDbSlots;
}

function isTransient(msg: string): boolean {
  // timeouts/rede/limite — NÃO faz retry de erro de SQL/sintaxe/credencial
  return /timeout|timed out|network|connection|terminated|reset|ECONN|socket|fetch failed| overloaded|429|503/i.test(msg);
}

async function guarded<T>(fn: () => Promise<T>): Promise<T> {
  const s = slots();
  if (s.active >= DB_CONCURRENCY) {
    if (s.queue.length >= DB_QUEUE_MAX) {
      throw new Error("banco sobrecarregado — tente novamente em instantes");
    }
    await new Promise<void>((r) => s.queue.push(r));
  }
  s.active++;
  const release = () => {
    s.active--;
    s.queue.shift()?.();
  };
  try {
    const attempt = (): Promise<T> =>
      Promise.race([
        fn(),
        new Promise<never>((_, rej) =>
          setTimeout(() => rej(new Error(`timeout ${DB_TIMEOUT_MS / 1000}s — banco não respondeu`)), DB_TIMEOUT_MS)
        ),
      ]);
    try {
      return await attempt();
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      if (isTransient(msg)) {
        // 1 retry único (sem backoff longo — o semáforo já limita a pressão)
        return await attempt();
      }
      throw e;
    }
  } finally {
    release();
  }
}

function withReliability(client: PrismaClient): PrismaClient {
  const ext = client.$extends({
    query: {
      $allOperations({ args, query }) {
        return guarded(() => query(args));
      },
    },
  });
  // a extensão preserva toda a API usada no projeto (modelos + $queryRawUnsafe)
  return ext as unknown as PrismaClient;
}

function createClient(): PrismaClient {
  if (isLibsqlMode) {
    // @prisma/adapter-libsql@6.x: PrismaLibSQL é uma FACTORY que recebe a config
    // do @libsql/client e instancia o client internamente.
    const adapter = new PrismaLibSQL({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    // FKs: o Turso Cloud já impõe chaves estrangeiras por padrão; o PRAGMA abaixo
    // é best-effort (falha silenciosa onde não se aplica).
    createLibsqlClient({
      url: process.env.DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
      .execute('PRAGMA foreign_keys = ON')
      .catch(() => {})
    return withReliability(new PrismaClient({ adapter, log: ['error'] }))
  }

  const client = new PrismaClient({ log: ['error'] })
  // Isolamento SQLite: esperamos por lock (busy_timeout) e ligamos as FKs.
  client
    .$queryRawUnsafe('PRAGMA journal_mode = WAL;')
    .catch(() => {})
  client
    .$queryRawUnsafe('PRAGMA synchronous = NORMAL;')
    .catch(() => {})
  client
    .$queryRawUnsafe('PRAGMA foreign_keys = ON;')
    .catch(() => {})
  client
    .$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
    .catch(() => {})
  return process.env.NODE_ENV === 'production' ? withReliability(client) : client
}

export const db = globalForPrisma.prisma ?? createClient()

globalForPrisma.__ovDbMode = isLibsqlMode ? 'libsql' : 'file'

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
