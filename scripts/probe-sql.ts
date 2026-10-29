// Probe do Turso: json_each, FTS5, placeholders ?, tempos de query — base da ETAPA 1
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL ?? "";
const token = process.env.TURSO_AUTH_TOKEN ?? "";
if (!url.startsWith("libsql://")) {
  console.error("DATABASE_URL deve ser libsql:// — rode via runtime json ou export");
  process.exit(1);
}
const db = createClient({ url, authToken: token });
const t = (label: string, ms: number) => console.log(`  ⏱  ${label}: ${ms}ms`);

async function main() {
  console.log("== 1. COUNT base ==");
  let t0 = Date.now();
  const c = await db.execute(`SELECT COUNT(*) as n FROM "Work"`);
  t("count total", Date.now() - t0);
  console.log("  total:", c.rows[0].n);

  console.log("== 2. json_each genre filter ==");
  t0 = Date.now();
  const g = await db.execute({
    sql: `SELECT "id","title" FROM "Work" WHERE "classification" != 'adult' AND "type" != 'drama'
          AND EXISTS (SELECT 1 FROM json_each("genres") je WHERE je.value = ?)
          ORDER BY "popularity" DESC LIMIT 5`,
    args: ["Action"],
  });
  t("genre Action top5", Date.now() - t0);
  console.log("  rows:", g.rows.length, "· 1º:", g.rows[0]?.title);

  console.log("== 3. json_extract tag filter ==");
  t0 = Date.now();
  const tg = await db.execute({
    sql: `SELECT COUNT(*) as n FROM "Work" w
          WHERE w."classification" != 'adult' AND w."type" != 'drama'
          AND EXISTS (SELECT 1 FROM json_each(w."tags") je
                      WHERE json_extract(je.value,'$.name') = ? AND json_extract(je.value,'$.rank') >= 40)`,
    args: ["Isekai"],
  });
  t("count tag Isekai", Date.now() - t0);
  console.log("  isekai:", tg.rows[0].n);

  console.log("== 4. placeholders ? no Prisma-style (libsql direto) ==");
  t0 = Date.now();
  const ph = await db.execute({
    sql: `SELECT "id" FROM "Work" WHERE "type" = ? AND "popularity" > ? ORDER BY "popularity" DESC LIMIT 3`,
    args: ["manhwa", 50000],
  });
  t("type+pop manhwa", Date.now() - t0);
  console.log("  manhwas:", ph.rows.map((r) => r.id).join(","));

  console.log("== 5. FTS5 disponível? ==");
  try {
    t0 = Date.now();
    await db.execute(`CREATE VIRTUAL TABLE IF NOT EXISTS probe_fts USING fts5(workId UNINDEXED, text)`);
    await db.execute(`INSERT INTO probe_fts(workId, text) VALUES ('probe-1', 'solo leveling OST')`);
    const f = await db.execute(`SELECT workId FROM probe_fts WHERE probe_fts MATCH ?`, ["solo*"]);
    t("FTS5 create+insert+match", Date.now() - t0);
    console.log("  FTS5 OK, matches:", f.rows.length);
    await db.execute(`DROP TABLE IF EXISTS probe_fts`);
  } catch (e) {
    console.log("  FTS5 INDISPONÍVEL:", (e as Error).message.slice(0, 120));
  }

  console.log("== 6. LIKE full scan (fallback busca) ==");
  t0 = Date.now();
  const lk = await db.execute({
    sql: `SELECT COUNT(*) as n FROM "Work" WHERE "classification" != 'adult' AND "type" != 'drama'
          AND ("title" LIKE ? OR "titleEn" LIKE ? OR "titleNative" LIKE ?)`,
    args: ["%solo%", "%solo%", "%solo%"],
  });
  t("LIKE %solo% full scan", Date.now() - t0);
  console.log("  matches:", lk.rows[0].n);

  console.log("== 7. facets via GROUP BY json_each ==");
  t0 = Date.now();
  const fc = await db.execute(`
    SELECT je.value AS name, COUNT(*) AS count FROM "Work" w, json_each(w."genres") je
    WHERE w."classification" != 'adult' AND w."type" != 'drama'
    GROUP BY je.value ORDER BY count DESC LIMIT 30`);
  t("facets genres GROUP BY", Date.now() - t0);
  console.log("  gêneros:", fc.rows.length, "· topo:", fc.rows[0]?.name, fc.rows[0]?.count);

  console.log("== 8. paginação popular 24 ==");
  t0 = Date.now();
  const pg = await db.execute({
    sql: `SELECT "id","title","popularity" FROM "Work"
          WHERE "classification" != 'adult' AND "type" != 'drama'
          ORDER BY "popularity" DESC LIMIT 24 OFFSET 24`,
    args: [],
  });
  t("page 2 popular", Date.now() - t0);
  console.log("  pág2 1º:", pg.rows[0]?.title, "· pop:", pg.rows[0]?.popularity);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("PROBE FALHOU:", e);
    process.exit(1);
  });
