// Diagnóstico + correção: colunas DateTime com valores epoch-ms no Turso.
// O adapter do Prisma é rigoroso: DateTime exige ISO-8601, aceita "1793257144741".
// Uso: TURSO_URL=... TURSO_AUTH_TOKEN=... node scripts/turso-fix-dates.mjs [--fix]
const URL_ = process.env.TURSO_URL ?? "libsql://otakuverse-fla-vyus.turso.io";
const TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";
const FIX = process.argv.includes("--fix");

const { createClient } = await import("@libsql/client");
const c = createClient({ url: URL_, authToken: TOKEN });

// colunas DateTime declaradas no schema.prisma (Work + EventLog + demais)
const CANDIDATES = ["createdAt", "updatedAt", "at"];

for (const table of ["Work", "EventLog"]) {
  for (const col of CANDIDATES) {
    try {
      const r = await c.execute({
        sql: `SELECT rowid AS rid, ${col} AS v FROM "${table}" WHERE ${col} IS NOT NULL LIMIT 500`,
        args: [],
      });
      if (r.rows.length === 0) continue;
      const sample = r.rows.map((x) => String(x.v));
      const epochMs = sample.filter((v) => /^\d{13}$/.test(v)).length;
      const epochS = sample.filter((v) => /^\d{10}$/.test(v)).length;
      console.log(`${table}.${col}: amostra ${sample[0]} · epochMs=${epochMs}/${sample.length} · epochS=${epochS}`);
      if (FIX && epochMs > 0) {
        // normaliza TODOS os epoch-ms dessa coluna para ISO (com Z)
        const u = await c.execute({
          sql: `UPDATE "${table}" SET ${col} = strftime('%Y-%m-%dT%H:%M:%fZ', ${col}/1000, 'unixepoch') WHERE ${col} GLOB '[0-9]*' AND length(${col}) = 13`,
          args: [],
        });
        console.log(`  ↳ FIX: ${u.rowsAffected} linhas normalizadas`);
      }
    } catch (e) {
      const m = String(e.message);
      if (!m.includes("no such column")) console.log(`${table}.${col}: ERRO ${m.slice(0, 80)}`);
    }
  }
}
console.log(FIX ? "fix aplicado" : "(diagnóstico — use --fix para corrigir)");
