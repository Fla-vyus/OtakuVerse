// Auditoria +18 (read-only): contagem de obras adultas e cobertura dos
// gêneros explícitos em WorkGenre. NÃO escreve nada no banco.
//
// Uso: DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… node scripts/audit-adult.mjs
//      (ou DATABASE_URL=file:db/validation.db para local)

import { createClient } from "@libsql/client";

const URL_ = process.env.DATABASE_URL ?? "";
const TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";
if (!URL_) {
  console.error("✗ DATABASE_URL ausente");
  process.exit(1);
}
const isRemote = /^libsql:\/\//i.test(URL_);
const db = createClient(isRemote ? { url: URL_, authToken: TOKEN } : { url: URL_ });

const EXPLICIT = ["Adult", "Hentai", "Erotica", "Smut"];

const q = async (sql, args = []) => (await db.execute({ sql, args })).rows;

(async () => {
  const t0 = Date.now();

  // (1) total de obras isAdult = 1
  const [adult] = await q(`SELECT COUNT(*) AS n FROM "Work" WHERE "isAdult" = 1`);
  const [total] = await q(`SELECT COUNT(*) AS n FROM "Work"`);
  console.log(`(1) isAdult = 1: ${adult.n} de ${total.n} obras (${((100 * adult.n) / total.n).toFixed(2)}%)`);

  // (2) obras por gênero explícito (query pedida)
  const byGenre = await q(
    `SELECT genre, COUNT(*) AS n FROM WorkGenre WHERE genre IN ('Adult','Hentai','Erotica','Smut') GROUP BY genre`
  );
  console.log(`(2) WorkGenre — gêneros explícitos:`);
  for (const g of EXPLICIT) {
    const row = byGenre.find((r) => r.genre === g);
    console.log(`    ${g}: ${row ? row.n : 0}`);
  }

  // (3) obras isAdult = 1 SEM nenhum dos quatro gêneros
  const [sem] = await q(
    `SELECT COUNT(*) AS n FROM "Work" w
     WHERE w."isAdult" = 1
       AND NOT EXISTS (
         SELECT 1 FROM WorkGenre wg
         WHERE wg.workId = w.id AND wg.genre IN ('Adult','Hentai','Erotica','Smut')
       )`
  );
  console.log(`(3) isAdult = 1 SEM Adult/Hentai/Erotica/Smut: ${sem.n}`);

  // (3b) detalhe: dessas, como está a distribuição por classification?
  const classif = await q(
    `SELECT w."classification" AS c, COUNT(*) AS n FROM "Work" w
     WHERE w."isAdult" = 1
       AND NOT EXISTS (
         SELECT 1 FROM WorkGenre wg
         WHERE wg.workId = w.id AND wg.genre IN ('Adult','Hentai','Erotica','Smut')
       )
     GROUP BY w."classification" ORDER BY n DESC`
  );
  console.log(`(3b) dessas, por classification: ${classif.map((r) => `${r.c}=${r.n}`).join(", ")}`);

  console.log(`✓ auditoria read-only em ${Date.now() - t0}ms`);
})().catch((e) => {
  console.error("ERRO:", String(e.message ?? e).slice(0, 160));
  process.exit(1);
});
