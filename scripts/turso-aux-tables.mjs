// OTAKUVERSE — migração/manutenção IDEMPOTENTE no Turso (ou SQLite local):
//   1. Índices de Work: startDate, nextEpisodeAt, (type,trending),
//      (type,status,popularity), country, format
//   2. Tabelas auxiliares WorkGenre/WorkTag populadas via json_each do JSON de
//      Work (não altera nem apaga Work)
//   3. ANALYZE
//   4. Contagens + top 60 tags
//
// Uso no Turso:
//   DATABASE_URL=libsql://otakuverse-fla-vyus.turso.io TURSO_AUTH_TOKEN=eyJ... \
//     node scripts/turso-aux-tables.mjs
// Uso em validação local (arquivo):
//   DATABASE_URL=file:db/validation.db node scripts/turso-aux-tables.mjs
//
// Flags: --window=N (janela de rowid, default 4000) · --skip-rebuild ·
//        --skip-analyze · --skip-indices

import { createClient } from "@libsql/client";
import {
  ensureAuxSchema,
  ensureWorkIndexes,
  rebuildAuxTables,
  analyzeAll,
  auxStats,
} from "./lib-aux-tables.mjs";

function argVal(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : def;
}
const hasFlag = (n) => process.argv.includes(n);

const URL_ = process.env.DATABASE_URL ?? "";
const TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";
if (!URL_) {
  console.error("✗ DATABASE_URL ausente (libsql://… para Turso ou file:… para local)");
  process.exit(1);
}
const isRemote = /^libsql:\/\//i.test(URL_);
if (isRemote && !TOKEN) {
  console.error("✗ TURSO_AUTH_TOKEN ausente para banco remoto");
  process.exit(1);
}
const WINDOW = Number(argVal("--window", "4000")) || 4000;

const t0 = Date.now();
const db = createClient(isRemote ? { url: URL_, authToken: TOKEN } : { url: URL_ });

console.log(`[1/5] Conectando…`);
await db.execute("SELECT 1");
const workCount = Number((await db.execute(`SELECT COUNT(*) AS n FROM "Work"`)).rows[0]?.n ?? 0);
console.log(`  ✓ ${isRemote ? "Turso" : "arquivo local"} OK — ${URL_.replace(/libsql:\/\/[^.]+/, "libsql://***")}`);
console.log(`  ✓ Work: ${workCount} obras`);

if (!hasFlag("--skip-indices")) {
  console.log(`[2/5] Índices de Work (IF NOT EXISTS)…`);
  await ensureWorkIndexes(db, (m) => console.log(m));
} else {
  console.log(`[2/5] Índices de Work: pulado (--skip-indices)`);
}

console.log(`[3/5] Tabelas auxiliares (DDL idempotente)…`);
await ensureAuxSchema(db, (m) => console.log(m));

if (!hasFlag("--skip-rebuild")) {
  console.log(`[4/5] Rebuild WorkGenre/WorkTag via json_each (janelas de ${WINDOW})…`);
  const tR = Date.now();
  const r = await rebuildAuxTables(db, { windowSize: WINDOW, log: (m) => console.log(m) });
  if (r.errors.length) {
    console.error(`  ✗ ${r.errors.length} janela(s) com erro:`);
    for (const e of r.errors.slice(0, 5)) console.error(`   · ${e}`);
  }
  console.log(`  ✓ ${r.windows} janelas em ${((Date.now() - tR) / 1000).toFixed(1)}s`);
} else {
  console.log(`[4/5] Rebuild: pulado (--skip-rebuild)`);
}

if (!hasFlag("--skip-analyze")) {
  console.log(`[5/5] ANALYZE…`);
  const tA = Date.now();
  await analyzeAll(db);
  console.log(`  ✓ ANALYZE em ${((Date.now() - tA) / 1000).toFixed(1)}s`);
} else {
  console.log(`[5/5] ANALYZE: pulado (--skip-analyze)`);
}

const s = await auxStats(db, 60);
console.log(`\n===== CONTAGENS =====`);
console.log(`  Work       : ${s.work} obras (não alterada)`);
console.log(`  WorkGenre  : ${s.workGenre} linhas (${s.obrasComGenero} obras com ≥1 gênero)`);
console.log(`  WorkTag    : ${s.workTag} linhas (${s.obrasComTag} obras com ≥1 tag)`);

console.log(`\n===== TOP 60 TAGS =====`);
for (let i = 0; i < s.topTags.length; i++) {
  const t = s.topTags[i];
  console.log(`  ${String(i + 1).padStart(2)}. ${t.name} — ${t.n}`);
}

console.log(`\n✓ concluído em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(0);
