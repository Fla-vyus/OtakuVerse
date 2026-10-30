// Constrói db/validation.db a partir do snapshot do catálogo (40.456 obras),
// para validar a migração de tabelas auxiliares LOCALMENTE antes de tocar no Turso.
// Não toca em db/custom.db (banco de dev da plataforma).
//
// Uso: node scripts/build-validation-db.mjs

import { createClient } from "@libsql/client";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import readline from "node:readline";
import { unlinkSync } from "node:fs";

const OUT = "db/validation.db";
const SNAPSHOT = "data/catalog-snapshot.jsonl.gz";

// DDL exato da tabela Work (copiado de sqlite_master — igual ao do Turso)
const WORK_DDL = `CREATE TABLE "Work" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "malId" INTEGER,
    "type" TEXT NOT NULL,
    "format" TEXT,
    "title" TEXT NOT NULL,
    "titleEn" TEXT,
    "titleNative" TEXT,
    "synonyms" TEXT,
    "synopsis" TEXT,
    "synopsisPT" TEXT,
    "cover" TEXT NOT NULL,
    "coverAlt" TEXT,
    "coverColor" TEXT,
    "banner" TEXT,
    "status" TEXT,
    "chapters" INTEGER,
    "volumes" INTEGER,
    "episodes" INTEGER,
    "duration" INTEGER,
    "startDate" TEXT,
    "endDate" TEXT,
    "country" TEXT,
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "classification" TEXT NOT NULL DEFAULT 'safe',
    "adultTags" TEXT,
    "genres" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "avgScore" INTEGER,
    "popularity" INTEGER,
    "favourites" INTEGER,
    "authors" TEXT,
    "extLinks" TEXT,
    "magazine" TEXT,
    "network" TEXT,
    "source" TEXT,
    "siteUrl" TEXT,
    "lastUpdate" INTEGER,
    "nextEpisodeAt" TEXT,
    "nextEpisodeNum" INTEGER,
    "coverAlts" TEXT,
    "langs" TEXT,
    "ptTags" TEXT,
    "trending" INTEGER,
    "trendingAt" INTEGER,
    "spicy" INTEGER NOT NULL DEFAULT 0,
    "follows" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const COLS = [
  "id", "malId", "type", "format", "title", "titleEn", "titleNative", "synonyms",
  "synopsis", "synopsisPT", "cover", "coverAlt", "coverColor", "banner", "status",
  "chapters", "volumes", "episodes", "duration", "startDate", "endDate", "country",
  "isAdult", "classification", "adultTags", "genres", "tags", "avgScore",
  "popularity", "favourites", "authors", "extLinks", "magazine", "network",
  "source", "siteUrl", "lastUpdate", "nextEpisodeAt", "nextEpisodeNum",
  "coverAlts", "langs", "ptTags", "trending", "trendingAt", "spicy", "follows",
  "createdAt",
];

function toCol(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string") return v;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return JSON.stringify(v); // arrays/objetos → texto JSON
}

const t0 = Date.now();
try { unlinkSync(OUT); } catch {}
try { unlinkSync(OUT + "-wal"); } catch {}
try { unlinkSync(OUT + "-shm"); } catch {}

const db = createClient({ url: `file:${OUT}` });
await db.execute(WORK_DDL);

const rl = readline.createInterface({
  input: createReadStream(SNAPSHOT).pipe(createGunzip()),
  crlfDelay: Infinity,
});

const BATCH_ROWS = 500;
let buffered = [];
let inserted = 0;
let lineNo = 0;

const colList = COLS.map((c) => `"${c}"`).join(", ");
const placeholders = `(${COLS.map(() => "?").join(",")})`;

for await (const line of rl) {
  if (!line.trim()) continue;
  lineNo++;
  let obj;
  try { obj = JSON.parse(line); } catch { console.warn(`linha ${lineNo}: JSON inválido, pulada`); continue; }
  buffered.push(COLS.map((c) => toCol(obj[c])));
  if (buffered.length >= BATCH_ROWS) {
    const stmts = chunk(buffered, 100).map((slice) => ({
      sql: `INSERT INTO "Work" (${colList}) VALUES ${slice.map(() => placeholders).join(",")}`,
      args: slice.flat(),
    }));
    await db.batch(stmts, "write");
    inserted += buffered.length;
    buffered = [];
    if (inserted % 10000 === 0) console.log(`  · ${inserted} obras…`);
  }
}
if (buffered.length) {
  const stmts = chunk(buffered, 100).map((slice) => ({
    sql: `INSERT INTO "Work" (${colList}) VALUES ${slice.map(() => placeholders).join(",")}`,
    args: slice.flat(),
  }));
  await db.batch(stmts, "write");
  inserted += buffered.length;
}

const n = Number((await db.execute(`SELECT COUNT(*) AS n FROM "Work"`)).rows[0]?.n ?? 0);
console.log(`✓ db/validation.db: ${n} obras inseridas (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
if (n !== 40456) console.warn(`⚠ esperado 40456 (manifest) — recebido ${n}`);
process.exit(0);

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
