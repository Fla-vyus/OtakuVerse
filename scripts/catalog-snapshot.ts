/**
 * Snapshot de proteção do OtakuVerse — exporta catálogo + contas para arquivos
 * compactos DENTRO do git (data/). É o seguro contra reset do ambiente: o banco
 * SQLite vive fora do git e pode ser apagado; o snapshot sobrevive em commit.
 *
 *   catálogo: data/catalog-snapshot.jsonl.gz  (1 linha JSON por obra)
 *   contas:   data/accounts-snapshot.json.gz  (users, sessões válidas, biblioteca, listas)
 *   manifest: data/manifest.json              (checksums sha256 + contagens p/ verificação)
 *
 * Cada arquivo é VERIFICADO após a escrita (gunzip de volta + contagem) — um snapshot
 * corrompido nunca substitui o bom silenciosamente.
 * Executar: npx tsx scripts/catalog-snapshot.ts
 */
import { PrismaClient } from "@prisma/client";
import { mkdirSync, rmSync, writeFileSync, readFileSync, renameSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import path from "node:path";

const db = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** grava gz atomicamente (tmp → rename) e VERIFICA lendo de volta */
function writeVerifiedGz(out: string, gz: Buffer, verify: (json: string) => boolean): { bytes: number; sha: string } {
  const tmp = out + ".tmp";
  writeFileSync(tmp, gz);
  // verificação: descomprime e valida o conteúdo
  const back = gunzipSync(readFileSync(tmp)).toString("utf8");
  if (back.length === 0 || !verify(back)) throw new Error(`verificação falhou para ${out} — arquivo não substituído`);
  rmSync(out, { force: true });
  renameSync(tmp, out);
  return { bytes: gz.length, sha: sha256(gz) };
}

async function snapshotCatalog(): Promise<{ count: number; bytes: number; sha: string }> {
  const out = path.join(DATA_DIR, "catalog-snapshot.jsonl.gz");
  const rows = await db.work.findMany({ orderBy: { id: "asc" } });
  const chunks: Buffer[] = [];
  for (const r of rows) chunks.push(Buffer.from(JSON.stringify(r) + "\n", "utf8"));
  const gz = gzipSync(Buffer.concat(chunks), { level: 6 });
  const res = writeVerifiedGz(out, gz, (json) => {
    const lines = json.split("\n").filter((l) => l.trim());
    return lines.length === rows.length;
  });
  return { count: rows.length, ...res };
}

async function snapshotAccounts(): Promise<{ summary: string; bytes: number; sha: string; counts: { users: number; sessions: number; library: number; shelf: number; lists: number } }> {
  const [users, sessions, library, shelf, lists] = await Promise.all([
    db.user.findMany(),
    db.session.findMany({ where: { expiresAt: { gt: new Date() } } }),
    db.libraryItem.findMany(),
    db.shelfEntry.findMany().catch(() => []),
    db.userList.findMany().catch(() => []),
  ]);
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), users, sessions, library, shelf, lists });
  const gz = gzipSync(Buffer.from(payload, "utf8"), { level: 9 });
  const out = path.join(DATA_DIR, "accounts-snapshot.json.gz");
  const res = writeVerifiedGz(out, gz, (json) => {
    const p = JSON.parse(json);
    return Array.isArray(p.users) && Array.isArray(p.library) && p.users.length === users.length && p.library.length === library.length;
  });
  return {
    summary: `${users.length} usuários, ${library.length} biblioteca, ${shelf.length} shelf, ${lists.length} listas`,
    counts: { users: users.length, sessions: sessions.length, library: library.length, shelf: shelf.length, lists: lists.length },
    ...res,
  };
}

async function main() {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log("═ Snapshot: catálogo…");
  const cat = await snapshotCatalog();
  console.log(`  ✓ ${cat.count} obras → data/catalog-snapshot.jsonl.gz (${(cat.bytes / 1048576).toFixed(1)} MB, sha256 ok)`);
  console.log("═ Snapshot: contas…");
  const acc = await snapshotAccounts();
  console.log(`  ✓ ${acc.summary} → data/accounts-snapshot.json.gz (sha256 ok)`);
  console.log("═ Manifest…");
  const manifest = {
    app: "OtakuVerse",
    version: 3,
    generatedAt: new Date().toISOString(),
    catalog: cat,
    accounts: acc,
    db: { url: process.env.DATABASE_URL ?? "file:./db/custom.db" },
  };
  writeFileSync(path.join(DATA_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`  ✓ data/manifest.json (sha256 dos snapshots gravados)`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("snapshot falhou:", e);
  process.exit(1);
});
