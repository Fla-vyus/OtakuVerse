// v3.9 — runtime-env DEVE ser o primeiro import: injeta DATABASE_URL/TURSO_AUTH_TOKEN
// (e demais chaves) de otakuverse.runtime.json ANTES de isLibsqlMode ser avaliado.
import "./runtime-env";
import { PrismaClient } from '@prisma/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { createClient as createLibsqlClient } from '@libsql/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  __ovDbMode?: 'file' | 'libsql'
}

/**
 * Modo duplo do banco:
 *  - file:    SQLite local (sandbox/dev) — WAL + PRAGMAs de isolamento como sempre.
 *  - libsql:  Turso (produção serverless, ex.: Vercel) — driver adapter, sem
 *             engine binária no bundle. Mesmo schema Prisma (provider "sqlite").
 *
 * Detecção pelo PREFIXO da DATABASE_URL: libsql:// / wss:// / https:// = remoto.
 * PRAGMAs de conexão (WAL/synchronous/busy_timeout) são coisa de SQLite em disco —
 * no Turso eles são controlados pelo servidor e aplicados via try/catch (o HTTP
 * driver pode recusar; ignorar é seguro).
 */
export const isLibsqlMode = /^(libsql|wss|https):\/\//i.test(process.env.DATABASE_URL ?? '')

function createClient() {
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
    return new PrismaClient({ adapter, log: ['error'] })
  }

  const client = new PrismaClient({ log: ['error'] })
  // Isolamento SQLite: esperamos por lock (busy_timeout) e ligamos as FKs
  // (ON DELETE CASCADE de User → Session/LibraryItem/ShelfEntry/UserList).
  // WAL: leitores não bloqueiam a escrita e a escrita não bloqueia leitores
  // (backup/cron/nuvem rodando junto com visitas ao site deixam de dar
  // "database is busy"; pesquisa: padrão recomendado para SQLite em produção
  // read-heavy, com synchronous=NORMAL como equilíbrio segurança/velocidade).
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
  return client
}

export const db = globalForPrisma.prisma ?? createClient()

globalForPrisma.__ovDbMode = isLibsqlMode ? 'libsql' : 'file'

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
