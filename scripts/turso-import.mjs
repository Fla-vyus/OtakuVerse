// Importação do catálogo para o Turso — OTAKUVERSE → TURSO (libSQL).
//
// Uso (depois de criar a conta/db no Turso):
//   TURSO_URL=libsql://seu-db-sua-org.turso.io TURSO_AUTH_TOKEN=eyJ... npm run turso:import
//
// O que faz:
//   1. Copia o DDL (CREATE TABLE/INDEX/TRIGGER) do SQLite local → Turso
//   2. Copia TODAS as linhas de TODAS as tabelas em lotes transacionais
//   3. Verifica contagens linha a linha no final
//
// Flags:
//   --fresh   apaga os dados remotos antes de importar (reimport limpo)
//
// Requisitos: @libsql/client (já nas dependências). Nada de CLI do Turso.

const TABLES_SKIP = ["_prisma_migrations"]; // tabelas internas que não viajam

function argFlag(name) {
  return process.argv.includes(name);
}

const FRESH = argFlag("--fresh");
const LOCAL_URL = process.env.LOCAL_DB ?? `file:${process.cwd()}/db/custom.db`;
const REMOTE_URL = process.env.TURSO_URL ?? process.env.DATABASE_URL ?? "";
const REMOTE_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";

if (!/^libsql:\/\//i.test(REMOTE_URL)) {
  console.error("✗ TURSO_URL ausente ou inválida — use libsql://<db>-<org>.turso.io");
  console.error("  Pegue em: https://app.turso.tech → seu database → Connect (URL + token).");
  process.exit(1);
}
if (!REMOTE_TOKEN) {
  console.error("✗ TURSO_AUTH_TOKEN ausente — gere no Turso (Connect → token).");
  process.exit(1);
}

const { createClient } = await import("@libsql/client");

const local = createClient({ url: LOCAL_URL });
const remote = createClient({ url: REMOTE_URL, authToken: REMOTE_TOKEN });

const t0 = Date.now();
let totalRows = 0;
const errors = [];

console.log(`[1/3] Conectando…`);
await remote.execute("SELECT 1");
console.log(`  ✓ Turso OK (${REMOTE_URL})`);
console.log(`  ✓ Local OK (${LOCAL_URL})`);

console.log(`[2/3] Copiando DDL…`);
const objs = await local.execute(
  `SELECT name, type, sql FROM sqlite_master
   WHERE sql IS NOT NULL
     AND name NOT LIKE 'sqlite_%'
     AND name NOT IN ('${TABLES_SKIP.join("','")}')
   ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 WHEN 'trigger' THEN 2 ELSE 3 END`
);
const created = new Set();
for (const obj of objs.rows) {
  const name = obj.name;
  const type = obj.type;
  const sql = String(obj.sql);
  if (created.has(name)) continue;
  try {
    await remote.execute(sql);
    created.add(name);
    console.log(`  ✓ ${type} ${name}`);
  } catch (e) {
    const msg = String(e?.message ?? e);
    if (msg.includes("already exists")) {
      created.add(name);
      console.log(`  • ${type} ${name} já existe`);
    } else {
      errors.push(`DDL ${name}: ${msg}`);
      console.warn(`  ✗ ${type} ${name}: ${msg}`);
    }
  }
}

console.log(`[3/3] Copiando dados…`);
const tables = objs.rows.filter((r) => r.type === "table");
for (const t of tables) {
  const name = String(t.name);
  const q = `"${name}"`;
  const info = await local.execute(`PRAGMA table_info(${q})`);
  const cols = info.rows.map((r) => String(r.name));
  if (cols.length === 0) continue;

  // sem rowid? (WITHOUT ROWID) — fallback: paginação por OFFSET
  // (bind por parâmetro: aspas duplas viram identificador no SQLite!)
  const hasRowid = await local.execute({
    sql: "SELECT COUNT(*) AS n FROM pragma_table_list WHERE name = ? AND wr = 0",
    args: [name],
  });
  const useRowid = Number(hasRowid.rows[0]?.n ?? 0) > 0 && name !== "sqlite_sequence";

  let remoteCount = 0;
  try {
    const c = await remote.execute(`SELECT COUNT(*) AS n FROM ${q}`);
    remoteCount = Number(c.rows[0]?.n ?? 0);
  } catch {
    remoteCount = 0;
  }

  if (remoteCount > 0 && !FRESH) {
    console.log(`  • ${name}: ${remoteCount} linhas já no Turso — pulando (use --fresh para reimportar)`);
    continue;
  }
  if (FRESH && remoteCount > 0) {
    await remote.execute(`DELETE FROM ${q}`);
    console.log(`  ↺ ${name}: ${remoteCount} linhas removidas (--fresh)`);
  }

  const CHUNK = 200;
  let copied = 0;

  // Snapshot congelado de rowids ANTES de paginar: linhas deletadas/reinseridas
  // por jobs concorrentes mudam de rowid e reapareceriam num cursor "> last"
  // (visto em produção: UNIQUE constraint no Work.id). Com a lista congelada,
  // cada id é lido exatamente uma vez.
  let ids = null;
  if (useRowid) {
    const idRes = await local.execute(`SELECT rowid FROM ${q} ORDER BY rowid`);
    ids = idRes.rows.map((r) => Number(r.rowid));
  }

  for (let off = 0; ; off += CHUNK) {
    let res;
    if (ids) {
      const slice = ids.slice(off, off + CHUNK);
      if (slice.length === 0) break;
      const marks = slice.map(() => "?").join(", ");
      res = await local.execute({
        sql: `SELECT rowid AS __rid, * FROM ${q} WHERE rowid IN (${marks})`,
        args: slice,
      });
    } else {
      res = await local.execute(`SELECT rowid AS __rid, * FROM ${q} LIMIT ${CHUNK} OFFSET ${off}`);
    }
    const rows = res.rows.map((r) => {
      const { __rid, ...rest } = r;
      return rest;
    });
    if (rows.length === 0) break;

    const colList = cols.map((c) => `"${c}"`).join(", ");
    const stmts = [];
    const PER_STMT = 50;
    for (let i = 0; i < rows.length; i += PER_STMT) {
      const slice = rows.slice(i, i + PER_STMT);
      const valuesSql = slice
        .map(() => `(${cols.map(() => "?").join(", ")})`)
        .join(", ");
      const params = slice.flatMap((r) => cols.map((c) => r[c] ?? null));
      // OR REPLACE: idempotente — reimport/reexecução nunca quebra em UNIQUE
      stmts.push({ sql: `INSERT OR REPLACE INTO ${q} (${colList}) VALUES ${valuesSql}`, args: params });
    }
    try {
      await remote.batch(stmts, "write");
      copied += rows.length;
    } catch (e) {
      const msg = String(e?.message ?? e);
      errors.push(`Dados ${name}: ${msg}`);
      console.warn(`  ✗ ${name}: falha no lote (${copied}/${off} copiadas) — ${msg}`);
      break;
    }
  }
  if (copied > 0) console.log(`  ✓ ${name}: ${copied} linhas`);
  totalRows += copied;
}

console.log(`\n[verificação] contagens locais vs Turso:`);
let mismatches = 0;
for (const t of tables) {
  const name = String(t.name);
  const q = `"${name}"`;
  const a = Number((await local.execute(`SELECT COUNT(*) AS n FROM ${q}`)).rows[0]?.n ?? 0);
  const b = Number((await remote.execute(`SELECT COUNT(*) AS n FROM ${q}`)).rows[0]?.n ?? 0);
  const ok = a === b;
  if (!ok) mismatches++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}: local ${a} · turso ${b}`);
}

const secs = ((Date.now() - t0) / 1000).toFixed(1);
if (errors.length || mismatches) {
  console.error(`\n✗ IMPORT COM RESSALVAS — ${errors.length} erros, ${mismatches} tabelas divergentes (${secs}s)`);
  for (const e of errors.slice(0, 10)) console.error(`   · ${e}`);
  process.exit(2);
}
console.log(`\n✓ IMPORT OK — ${totalRows} linhas em ${secs}s. O banco do Turso é um clone do local.`);
console.log("  Próximo passo: coloque DATABASE_URL (libsql://…) e TURSO_AUTH_TOKEN nas env vars da Vercel.");
