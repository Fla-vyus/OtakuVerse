/**
 * Restore do OtakuVerse a partir dos snapshots git-safe (data/).
 * Recria o catálogo e as contas SEM nenhuma chamada externa — instantâneo.
 *
 * Executar: npx tsx scripts/catalog-restore.ts [--force]
 * Sem --force, só roda se o banco estiver praticamente vazio (< 10.000 obras).
 * Usado automaticamente pelo boot (src/lib/jobs.ts) quando o banco é perdido.
 */
import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import path from "node:path";

const db = new PrismaClient();
const DATA_DIR = path.join(process.cwd(), "data");

/** Valida o snapshot contra o manifest (sha256) antes de restaurar — um snapshot
 *  corrompido NUNCA é restaurado por cima do banco. */
function verifySnapshot(file: string): boolean {
  const manifestPath = path.join(DATA_DIR, "manifest.json");
  if (!existsSync(manifestPath)) return true; // sem manifest (snapshot antigo) — segue com aviso
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const expected =
      file.endsWith("catalog-snapshot.jsonl.gz") ? manifest.catalog?.sha : manifest.accounts?.sha;
    if (!expected) return true;
    const actual = createHash("sha256").update(readFileSync(file)).digest("hex");
    if (actual !== expected) {
      console.error(`  ✗ CHECKSUM INVÁLIDO em ${path.basename(file)} (esperado ${expected.slice(0, 12)}…, recebido ${actual.slice(0, 12)}…)`);
      return false;
    }
    return true;
  } catch {
    return true; // manifest ilegível não deve bloquear um resgate de emergência
  }
}

function rowsFromSnapshot(): any[] {
  const file = path.join(DATA_DIR, "catalog-snapshot.jsonl.gz");
  if (!existsSync(file)) return [];
  if (!verifySnapshot(file)) {
    console.error("  ✗ snapshot de catálogo corrompido — restore cancelado (proteção ao banco)");
    process.exit(1);
  }
  const jsonl = gunzipSync(readFileSync(file)).toString("utf8");
  const rows: any[] = [];
  for (const line of jsonl.split("\n")) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch {}
  }
  return rows;
}

async function restoreCatalog(): Promise<number> {
  const rows = rowsFromSnapshot();
  if (!rows.length) return 0;
  // SQLite NÃO suporta skipDuplicates no createMany — dedupe manual por id
  // (restore é ADITIVO: rerodar depois de um restore interrompido continua de onde parou)
  const existing = new Set<string>(
    (await db.work.findMany({ select: { id: true } })).map((w) => w.id),
  );
  const fresh = rows.filter((r) => r && typeof r.id === "string" && !existing.has(r.id));
  console.log(`  snapshot: ${rows.length} obras, novas: ${fresh.length} (já no banco: ${existing.size})`);
  const CHUNK = 400;
  let done = 0;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    await db.work.createMany({ data: chunk });
    done += chunk.length;
    if (done % 4000 === 0) console.log(`  … ${done}/${fresh.length}`);
  }
  return done;
}

async function restoreAccounts(): Promise<string> {
  const file = path.join(DATA_DIR, "accounts-snapshot.json.gz");
  if (!existsSync(file)) return "sem snapshot de contas";
  if (!verifySnapshot(file)) return "snapshot de contas corrompido — restauração pulada";
  const payload = JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
  const users = payload.users ?? [];
  const haveUsers = await db.user.count();
  let msg = "";
  if (users.length && haveUsers === 0) {
    for (const u of users) {
      await db.user.create({ data: u }).catch(() => {});
    }
    msg += `${users.length} usuários`;
  } else {
    msg += `contas preservadas (${haveUsers} existentes)`;
  }
  // sessões/biblioteca/listas: last-write-wins — só entram se as tabelas estão vazias
  const counts = {
    session: await db.session.count(),
    libraryItem: await db.libraryItem.count(),
  };
  const sessions = (payload.sessions ?? []) as any[];
  if (sessions.length && counts.session === 0) {
    const now = Date.now();
    const valid = sessions.filter((s) => new Date(s.expiresAt).getTime() > now);
    for (const s of valid) await db.session.create({ data: s }).catch(() => {});
    msg += `, ${valid.length} sessões válidas`;
  }
  const library = (payload.library ?? []) as any[];
  if (library.length && counts.libraryItem === 0) {
    for (const l of library) await db.libraryItem.create({ data: l }).catch(() => {});
    msg += `, ${library.length} itens de biblioteca`;
  }
  const shelf = (payload.shelf ?? []) as any[];
  if (shelf.length && (await db.shelfEntry.count().catch(() => 1)) === 0) {
    for (const s of shelf) await db.shelfEntry.create({ data: s }).catch(() => {});
    msg += `, ${shelf.length} shelf`;
  }
  const lists = (payload.lists ?? []) as any[];
  if (lists.length && (await db.userList.count().catch(() => 1)) === 0) {
    for (const l of lists) await db.userList.create({ data: l }).catch(() => {});
    msg += `, ${lists.length} listas`;
  }
  return msg;
}

(async () => {
  const force = process.argv.includes("--force");
  const total = await db.work.count();
  console.log(`Banco atual: ${total} obras`);
  if (total >= 10_000 && !force) {
    console.log("Banco saudável — restore não é necessário. Use --force para sobrescrever.");
    await db.$disconnect();
    return;
  }
  console.log("═ Restore: catálogo…");
  const n = await restoreCatalog();
  console.log(`  ✓ ${n} obras restauradas`);
  console.log("═ Restore: contas…");
  console.log(`  ✓ ${await restoreAccounts()}`);
  const after = await db.work.count();
  console.log(`Catálogo após restore: ${after} obras`);
  await db.$disconnect();
})().catch((e) => {
  console.error("restore falhou:", e);
  process.exit(1);
});
