/**
 * Snapshot de proteção do OtakuVerse — exporta catálogo + contas para arquivos
 * compactos DENTRO do git (data/). É o seguro contra reset do ambiente: o banco
 * SQLite vive fora do git e pode ser apagado; o snapshot sobrevive em commit.
 *
 *   catálogo: data/catalog-snapshot.jsonl.gz  (1 linha JSON por obra)
 *   contas:   data/accounts-snapshot.json.gz  (users, sessões válidas, biblioteca, listas)
 *
 * Executar: npx tsx scripts/catalog-snapshot.ts
 */
import { PrismaClient } from "@prisma/client";
import { createWriteStream } from "node:fs";
import { mkdirSync, rmSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";

const db = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

async function snapshotCatalog(): Promise<number> {
  const out = path.join(DATA_DIR, "catalog-snapshot.jsonl.gz");
  const tmp = out + ".tmp";
  const rows = await db.work.findMany({ orderBy: { id: "asc" } });
  const chunks: Buffer[] = [];
  for (const r of rows) {
    chunks.push(Buffer.from(JSON.stringify(r) + "\n", "utf8"));
    // libera memória em blocos a cada 500 linhas concatenando
  }
  const gz = gzipSync(Buffer.concat(chunks), { level: 6 });
  const fs = await import("node:fs");
  fs.writeFileSync(tmp, gz);
  rmSync(out, { force: true });
  fs.renameSync(tmp, out);
  return rows.length;
}

async function snapshotAccounts(): Promise<string> {
  const [users, sessions, library, shelf, lists] = await Promise.all([
    db.user.findMany(),
    db.session.findMany({ where: { expiresAt: { gt: new Date() } } }),
    db.libraryItem.findMany(),
    db.shelfEntry.findMany().catch(() => []),
    db.userList.findMany().catch(() => []),
  ]);
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), users, sessions, library, shelf, lists });
  const fs = await import("node:fs");
  const out = path.join(DATA_DIR, "accounts-snapshot.json.gz");
  const tmp = out + ".tmp";
  fs.writeFileSync(tmp, gzipSync(Buffer.from(payload, "utf8"), { level: 9 }));
  rmSync(out, { force: true });
  fs.renameSync(tmp, out);
  return `${users.length} usuários, ${library.length} biblioteca, ${shelf.length} shelf, ${lists.length} listas`;
}

(async () => {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log("═ Snapshot: catálogo…");
  const n = await snapshotCatalog();
  console.log(`  ✓ ${n} obras → data/catalog-snapshot.jsonl.gz`);
  console.log("═ Snapshot: contas…");
  const acc = await snapshotAccounts();
  console.log(`  ✓ ${acc} → data/accounts-snapshot.json.gz`);
  await db.$disconnect();
})().catch((e) => {
  console.error("snapshot falhou:", e);
  process.exit(1);
});
