// Backup de segurança do SQLite via VACUUM INTO (snapshot consistente, quente).
// Uso: npx tsx scripts/db-backup.ts          → 1 backup + rotação (mantém 10)
//      npx tsx scripts/db-backup.ts --check  → integrity_check do banco vivo
import { PrismaClient } from "@prisma/client";
import { readdirSync, statSync, unlinkSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const url = process.env.DATABASE_URL ?? "file:./db/custom.db";
const dbPath = resolve(ROOT, url.replace(/^file:/, ""));
const dir = join(ROOT, "db", "backups");
mkdirSync(dir, { recursive: true });
const KEEP = 10;

const live = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  if (process.argv.includes("--check")) {
    const r: any = await live.$queryRawUnsafe("PRAGMA integrity_check;");
    console.log("integrity:", JSON.stringify(r));
    await live.$disconnect();
    return;
  }
  // snapshot consistente mesmo com o servidor rodando (VACUUM INTO usa transação)
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const target = join(dir, `otakuverse-${stamp}.db`);
  await live.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  const size = statSync(target).size;
  console.log(`backup ok: ${target} (${(size / 1024 / 1024).toFixed(1)} MB)`);

  // verificação: o arquivo de backup TEM que passar no integrity_check — um backup
  // corrompido não é backup. Se falhar, é removido para não poluir a rotação.
  const checkDb = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
  try {
    const r: any = await checkDb.$queryRawUnsafe("PRAGMA integrity_check;");
    const result = Array.isArray(r) ? (r[0]?.integrity_check ?? "unknown") : "unknown";
    if (result !== "ok") {
      console.error(`backup CORROMPIDO (integrity: ${result}) — removendo…`);
      unlinkSync(target);
    } else {
      console.log("integrity_check do backup: ok");
    }
  } finally {
    await checkDb.$disconnect().catch(() => {});
  }

  // rotação: mantém os KEEP mais recentes
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .sort()
    .reverse();
  for (const f of files.slice(KEEP)) {
    unlinkSync(join(dir, f));
    console.log("rotacionado (removido):", f);
  }
  await live.$disconnect();
}

main().catch((e) => {
  console.error("backup FALHOU:", e.message);
  process.exit(1);
});
