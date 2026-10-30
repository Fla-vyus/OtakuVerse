// OTAKUVERSE — fonte única de verdade para as tabelas auxiliares WorkGenre / WorkTag.
//
// Por quê: Work.genres e Work.tags são TEXT com JSON. Filtrar por gênero/tag com
// LIKE sobre JSON não usa índice. Estas tabelas normalizam o JSON (uma linha por
// par obra×gênero e obra×tag) para permitir JOIN/filtro indexado — ETAPA 1 do
// plano de estabilidade (SQL paginado direto no Turso).
//
// GARANTIAS:
//   • NUNCA altera nem apaga a tabela Work (só lê; DELETEs são nas auxiliares).
//   • Idempotente: DDL com IF NOT EXISTS; rebuild por janelas de rowid com
//     DELETE+INSERT atômicos por janela (reexecutar produz o mesmo resultado).
//   • json_valid() + guardas antes de json_each() — linhas com JSON inválido
//     nunca quebram o lote.
//
// Consumidores:
//   • scripts/turso-aux-tables.mjs  (CLI de migração/manutenção — este arquivo)
//   • scripts/turso-import.mjs      (importação local → Turso)
//   • scripts/db-indexes.ts         (DDL de índices idempotente)
//   • src/app/api/admin/refresh     (refresh publicado — mesma lógica via Prisma raw)
//
// Nota: os DDLs aqui usam nomes no estilo Prisma ("Work_col_idx") para os índices
// de Work e nomes explícitos para os das auxiliares.

// ── Índices pedidos sobre Work (todos IF NOT EXISTS; Work_startDate_idx já
//    existe no Turso — criado pelo Prisma — e aqui é no-op) ──────────────────
export const WORK_INDEXES = [
  ["Work_startDate_idx", `CREATE INDEX IF NOT EXISTS "Work_startDate_idx" ON "Work"("startDate")`],
  ["Work_nextEpisodeAt_idx", `CREATE INDEX IF NOT EXISTS "Work_nextEpisodeAt_idx" ON "Work"("nextEpisodeAt")`],
  ["Work_type_trending_idx", `CREATE INDEX IF NOT EXISTS "Work_type_trending_idx" ON "Work"("type","trending")`],
  ["Work_type_status_popularity_idx", `CREATE INDEX IF NOT EXISTS "Work_type_status_popularity_idx" ON "Work"("type","status","popularity")`],
  ["Work_country_idx", `CREATE INDEX IF NOT EXISTS "Work_country_idx" ON "Work"("country")`],
  ["Work_format_idx", `CREATE INDEX IF NOT EXISTS "Work_format_idx" ON "Work"("format")`],
  ["Work_isAdult_type_popularity_idx", `CREATE INDEX IF NOT EXISTS "Work_isAdult_type_popularity_idx" ON "Work"("isAdult","type","popularity")`],
];

// ── Tabelas auxiliares (DDL das tabelas; índices vêm separados para poder
//    criá-los depois da carga em massa quando quiser) ─────────────────────────
export const AUX_TABLES_DDL = [
  `CREATE TABLE IF NOT EXISTS WorkGenre (
     workId TEXT NOT NULL,
     genre  TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS WorkTag (
     workId TEXT NOT NULL,
     name   TEXT NOT NULL,
     rank   INTEGER
   )`,
];

export const AUX_INDEX_DDL = [
  `CREATE INDEX IF NOT EXISTS WorkGenre_genre_workId_idx ON WorkGenre("genre","workId")`,
  `CREATE INDEX IF NOT EXISTS WorkGenre_workId_idx ON WorkGenre("workId")`,
  `CREATE INDEX IF NOT EXISTS WorkTag_name_workId_idx ON WorkTag("name","workId")`,
  `CREATE INDEX IF NOT EXISTS WorkTag_workId_idx ON WorkTag("workId")`,
];

export const AUX_DDL = [...AUX_TABLES_DDL, ...AUX_INDEX_DDL];

// ── Executa todo o DDL (tabelas + índices). Idempotente. ────────────────────
export async function ensureAuxSchema(db, log = () => {}) {
  for (const sql of AUX_DDL) {
    try {
      await db.execute(sql);
      log(`  ✓ ${sql.slice(0, 58).replace(/\s+/g, " ")}…`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (!msg.includes("already exists")) throw e;
      log(`  • já existe: ${sql.slice(12, 50).replace(/\s+/g, " ")}…`);
    }
  }
}

// ── Executa os índices de Work (idempotente) e devolve o relatório. ─────────
export async function ensureWorkIndexes(db, log = () => {}) {
  const report = [];
  for (const [name, sql] of WORK_INDEXES) {
    try {
      await db.execute(sql);
      report.push([name, "ok"]);
      log(`  ✓ índice ${name}`);
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("already exists")) {
        report.push([name, "já existia"]);
        log(`  • índice ${name} já existia`);
      } else {
        report.push([name, `ERRO: ${msg.slice(0, 120)}`]);
        log(`  ✗ índice ${name}: ${msg.slice(0, 120)}`);
      }
    }
  }
  return report;
}

// ── Rebuild das auxiliares por janelas de rowid de Work. ────────────────────
// Cada janela = 1 transação (batch) com 4 statements: DELETE WorkGenre/WorkTag
// das obras da janela + INSERT SELECT via json_each. Se uma janela falhar, as
// demais seguem (erro reportado) — nunca deixa as tabelas totalmente vazias
// (diferente de um DELETE global seguido de INSERT que pode quebrar no meio).
export async function rebuildAuxTables(db, opts = {}) {
  const windowSize = opts.windowSize ?? 4000;
  const log = opts.log ?? (() => {});
  const maxRes = await db.execute(`SELECT COALESCE(MAX(rowid), 0) AS m FROM "Work"`);
  const maxRowid = Number(maxRes.rows[0]?.m ?? 0);
  const errors = [];
  let windows = 0;
  log(`  · Work: max(rowid)=${maxRowid}, janelas de ${windowSize}`);
  for (let start = 1; start <= maxRowid; start += windowSize) {
    const end = start + windowSize;
    try {
      await db.batch(
        [
          {
            sql: `DELETE FROM WorkGenre WHERE workId IN (SELECT "id" FROM "Work" WHERE rowid >= ? AND rowid < ?)`,
            args: [start, end],
          },
          {
            sql: `DELETE FROM WorkTag WHERE workId IN (SELECT "id" FROM "Work" WHERE rowid >= ? AND rowid < ?)`,
            args: [start, end],
          },
          {
            // genres: JSON array de strings. json_valid + LIKE '[%' protegem o json_each.
            sql: `INSERT INTO WorkGenre(workId, genre)
                  SELECT DISTINCT w."id", j.value
                  FROM (SELECT "id", "genres" FROM "Work"
                        WHERE rowid >= ? AND rowid < ?
                          AND "genres" IS NOT NULL AND json_valid("genres") AND "genres" LIKE '[%') w,
                       json_each(w."genres") j
                  WHERE j.type = 'text' AND TRIM(j.value) != ''`,
            args: [start, end],
          },
          {
            // tags: JSON array de objetos {name, rank}. rank pode faltar → NULL.
            sql: `INSERT INTO WorkTag(workId, name, rank)
                  SELECT DISTINCT w."id", json_extract(t.value, '$.name'), CAST(json_extract(t.value, '$.rank') AS INTEGER)
                  FROM (SELECT "id", "tags" FROM "Work"
                        WHERE rowid >= ? AND rowid < ?
                          AND "tags" IS NOT NULL AND json_valid("tags") AND "tags" LIKE '[%') w,
                       json_each(w."tags") t
                  WHERE json_type(t.value) = 'object'
                    AND COALESCE(json_extract(t.value, '$.name'), '') != ''`,
            args: [start, end],
          },
        ],
        "write"
      );
      windows++;
      if (windows % 5 === 0 || end >= maxRowid) log(`  · janelas processadas: ${windows} (até rowid ${end - 1})`);
    } catch (e) {
      const msg = String(e?.message ?? e).slice(0, 200);
      errors.push(`rowid [${start},${end}): ${msg}`);
      log(`  ✗ janela [${start},${end}): ${msg}`);
    }
  }
  return { windows, errors, maxRowid };
}

// ── ANALYZE (planejador com estatísticas das novas tabelas/índices). ────────
export async function analyzeAll(db) {
  await db.execute("ANALYZE");
}

// ── Contagens + top N tags. ──────────────────────────────────────────────────
export async function auxStats(db, topN = 60) {
  const q = async (sql) => Number((await db.execute(sql)).rows[0]?.n ?? 0);
  const work = await q(`SELECT COUNT(*) AS n FROM "Work"`);
  const workGenre = await q(`SELECT COUNT(*) AS n FROM WorkGenre`);
  const workTag = await q(`SELECT COUNT(*) AS n FROM WorkTag`);
  const obrasComGenero = await q(`SELECT COUNT(DISTINCT workId) AS n FROM WorkGenre`);
  const obrasComTag = await q(`SELECT COUNT(DISTINCT workId) AS n FROM WorkTag`);
  const top = await db.execute(`SELECT name, COUNT(*) AS n FROM WorkTag GROUP BY name ORDER BY n DESC, name LIMIT ${topN}`);
  const topTags = top.rows.map((r) => ({ name: String(r.name), n: Number(r.n) }));
  return { work, workGenre, workTag, obrasComGenero, obrasComTag, topTags };
}
