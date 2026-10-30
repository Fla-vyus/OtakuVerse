// Inspeciona o schema real no Turso: CREATE TABLEs, tabelas FTS e uma linha de exemplo.
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

function loadCreds() {
  const candidates = [
    "/home/z/my-project/otakuverse.runtime.json",
    "/home/z/.otakuverse-credentials.json",
  ];
  for (const p of candidates) {
    try {
      const j = JSON.parse(readFileSync(p, "utf8"));
      if (j.DATABASE_URL && j.TURSO_AUTH_TOKEN) return j;
    } catch {}
  }
  return null;
}

const creds = loadCreds();
if (!creds) {
  console.error("SEM CREDENCIAIS");
  process.exit(1);
}

const db = createClient({
  url: creds.DATABASE_URL,
  authToken: creds.TURSO_AUTH_TOKEN,
});

// 1) Todas as tabelas
const tables = await db.execute(
  "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name"
);
console.log("=== TABELAS ===");
for (const r of tables.rows) console.log(` - ${r.name} (${r.type})`);

// 2) CREATE TABLE de todas (para achar a de obras) — sem imprimir blob gigantes
console.log("\n=== CREATE TABLE statements ===");
for (const t of tables.rows) {
  const sql = await db.execute({
    sql: "SELECT sql FROM sqlite_master WHERE name = ?",
    args: [t.name],
  });
  const ddl = sql.rows[0]?.sql ?? "(n/a)";
  if (ddl.length > 2500) {
    console.log(`\n-- ${t.name} (truncado, ${ddl.length} chars):`);
    console.log(ddl.slice(0, 2500) + "\n... [truncado]");
  } else {
    console.log(`\n-- ${t.name}:`);
    console.log(ddl);
  }
}

// 3) Identifica tabela principal de obras e conta linhas
const countWorks = await db.execute("SELECT COUNT(*) AS n FROM works");
console.log(`\n=== works: ${countWorks.rows[0].n} linhas ===`);

// 4) Uma linha de exemplo (colunas de texto, sem campos gigantes)
const sample = await db.execute("SELECT * FROM works LIMIT 1");
console.log("\n=== EXEMPLO DE LINHA (works) ===");
for (const [k, v] of Object.entries(sample.rows[0])) {
  let val = typeof v === "string" ? v : JSON.stringify(v);
  if (val && val.length > 220) val = val.slice(0, 220) + `... [${val.length} chars total]`;
  console.log(`  ${k}: ${val}`);
}
