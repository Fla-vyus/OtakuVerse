import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createClient() {
  const client = new PrismaClient({ log: ['error'] })
  // Isolamento SQLite: esperamos por lock (busy_timeout) e ligamos as FKs
  // (ON DELETE CASCADE de User → Session/LibraryItem/ShelfEntry/UserList).
  client
    .$queryRawUnsafe('PRAGMA foreign_keys = ON;')
    .catch(() => {})
  client
    .$queryRawUnsafe('PRAGMA busy_timeout = 5000;')
    .catch(() => {})
  return client
}

export const db = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db