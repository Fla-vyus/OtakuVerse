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
  // portão de sanidade: backup de um catálogo quebrado só ocuparia a rotação —
  // pule até o banco ser restaurado (os cofres ficam protegidos pelo próprio gate)
  const workCount = await live.$queryRawUnsafe<{ n: number }[]>("SELECT COUNT(*) n FROM Work");
  const n = Number(workCount[0]?.n ?? 0);
  if (n < 10_000) {
    console.log(`banco com apenas ${n} obras — backup ADIADO (restaure o catálogo primeiro)`);
    await live.$disconnect();
    return;
  }
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

  // checkpoint do WAL: o -wal acumula writes desde o último checkpoint e, se crescer
  // demais (vimos um de 178MB), um kill -9 do processo pode corromper a imagem do banco.
  // TRUNCATE aplica tudo e zera o arquivo — mantém o banco compacto e seguro.
  try {
    const cp = await live.$queryRawUnsafe<any[]>("PRAGMA wal_checkpoint(TRUNCATE);");
    const st = cp?.[0]?.busy ? "busy (tentará de novo no próximo backup)" : "ok";
    let walMB = "?";
    try { walMB = (statSync(dbPath + "-wal").size / 1024 / 1024).toFixed(1); } catch {}
    console.log(`wal_checkpoint: ${st} (wal agora: ${walMB} MB)`);
  } catch (e: any) {
    console.log("wal_checkpoint pulado:", String(e?.message ?? e).slice(0, 80));
  }

  await live.$disconnect();
}

main().catch((e) => {
  console.error("backup FALHOU:", e.message);
  process.exit(1);
});
