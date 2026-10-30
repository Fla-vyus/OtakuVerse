// ETAPA 1 — índices + FTS5 no banco (Turso ou SQLite local). IDEMPOTENTE.
// Uso: DATABASE_URL=... TURSO_AUTH_TOKEN=... node scripts/db-indexes.ts [--fts]
// O rebuild do FTS (--fts) roda no admin/refresh e aqui de forma manual.
// Os índices de Work e o DDL das auxiliares WorkGenre/WorkTag vêm de
// scripts/lib-aux-tables.mjs (fonte única de verdade).
import { createClient } from "@libsql/client";
import { WORK_INDEXES, AUX_DDL } from "./lib-aux-tables.mjs";

const url = process.env.DATABASE_URL ?? "";
const token = process.env.TURSO_AUTH_TOKEN ?? "";
const rebuildFts = process.argv.includes("--fts");

const INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_work_popularity ON "Work"("popularity")`,
  `CREATE INDEX IF NOT EXISTS idx_work_score ON "Work"("avgScore")`,
  `CREATE INDEX IF NOT EXISTS idx_work_favourites ON "Work"("favourites")`,
  `CREATE INDEX IF NOT EXISTS idx_work_chapters ON "Work"("chapters")`,
  `CREATE INDEX IF NOT EXISTS idx_work_title ON "Work"("title")`,
  `CREATE INDEX IF NOT EXISTS idx_work_class_pop ON "Work"("classification","popularity")`,
  `CREATE INDEX IF NOT EXISTS idx_work_class_fav ON "Work"("classification","favourites")`,
  `CREATE INDEX IF NOT EXISTS idx_work_status_pop ON "Work"("status","popularity")`,
  `CREATE INDEX IF NOT EXISTS idx_work_lastupdate ON "Work"("lastUpdate")`,
  // índices novos (startDate, nextEpisodeAt, type+trending, type+status+popularity,
  // country, format) — fonte única em lib-aux-tables.mjs
  ...WORK_INDEXES.map(([, sql]) => sql),
  // tabelas auxiliares de gênero/tag (DDL idempotente; rebuild fica no CLI e no admin/refresh)
  ...AUX_DDL,
  `CREATE TABLE IF NOT EXISTS home_cache (key TEXT PRIMARY KEY, json TEXT NOT NULL, at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS tag_stats (name TEXT PRIMARY KEY, count INTEGER NOT NULL)`,
];

async function main() {
  if (!url) {
    console.error("DATABASE_URL ausente — exporte ou rode com o runtime json carregado");
    process.exit(1);
  }
  const db = createClient(url.startsWith("libsql://") ? { url, authToken: token } : { url });
  const t0 = Date.now();
  for (const sql of INDEXES) {
    const label = sql.slice(0, 60).replace(/\s+/g, " ");
    try {
      await db.execute(sql);
      console.log(`  ✓ ${label}…`);
    } catch (e) {
      console.error(`  ✗ ${label}… → ${(e as Error).message.slice(0, 120)}`);
    }
  }

  if (rebuildFts) {
    console.log("== FTS5: reconstruindo índice de busca ==");
    await db.execute(`CREATE VIRTUAL TABLE IF NOT EXISTS work_fts USING fts5(workId UNINDEXED, text)`);
    await db.execute(`DELETE FROM work_fts`);
    await db.execute(
      `INSERT INTO work_fts(workId, text)
       SELECT "id", "title" || ' ' || COALESCE("titleEn",'') || ' ' || COALESCE("titleNative",'') || ' ' || COALESCE("synonyms",'') || ' ' || COALESCE("authors",'')
       FROM "Work" WHERE "classification" != 'adult' AND "type" != 'drama'`
    );
    const n = await db.execute(`SELECT COUNT(*) as n FROM work_fts`);
    console.log(`  ✓ work_fts com ${n.rows[0].n} documentos (${Date.now() - t0}ms totais)`);
  }
  console.log(`concluído em ${Date.now() - t0}ms`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FALHOU:", e);
    process.exit(1);
  });
