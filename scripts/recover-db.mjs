// Recuperação do banco SQLite corrompido (Work tree malformada).
// Estratégia: novo banco com DDL do Prisma → copiar tabelas pequenas inteiras →
// salvar Work por janelas de rowid pulando páginas corrompidas.
import { DatabaseSync } from "node:sqlite";

const SRC = "db/custom.db";
const DST = "db/recovered.db";

const src = new DatabaseSync(SRC, { readOnly: true });
const dst = new DatabaseSync(DST);

// ---------- 1) copiar tabelas pequenas ----------
const SMALL = ["User", "Session", "LibraryItem", "EventLog"];
for (const t of SMALL) {
  let rows;
  try {
    rows = src.prepare(`SELECT * FROM "${t}"`).all();
  } catch (e) {
    console.log(`!! ${t}: leitura falhou (${e.message}) — tentando por rowid`);
    rows = salvageByRowid(src, t);
  }
  const cols = rows.length ? Object.keys(rows[0]) : src.prepare(`PRAGMA table_info("${t}")`).all().map((c) => c.name);
  if (!rows.length) {
    console.log(`-- ${t}: 0 linhas (nada a copiar)`);
    continue;
  }
  const placeholders = cols.map(() => "?").join(",");
  const q = `INSERT OR IGNORE INTO "${t}" (${cols.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`;
  const ins = dst.prepare(q);
  dst.exec("BEGIN");
  for (const r of rows) {
    try {
      ins.run(...cols.map((c) => r[c]));
    } catch (e) {
      console.log(`   ${t}: linha pulada: ${e.message.slice(0, 80)}`);
    }
  }
  dst.exec("COMMIT");
  console.log(`OK ${t}: ${rows.length} linhas copiadas`);
}

// ---------- 2) salvar Work por janelas de rowid ----------
function salvageByRowid(db, table, chunk = 500) {
  const out = [];
  let lo = 0;
  for (;;) {
    let batch;
    try {
      batch = db.prepare(`SELECT * FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT ?`).all(lo, chunk);
    } catch {
      // janela corrompida: avança 1 a 1 para resgatar o que der
      try {
        const one = db.prepare(`SELECT * FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT 1`).all(lo, 1);
        if (one.length) {
          out.push(...one);
          lo = one[0].rowid;
          continue;
        }
      } catch {}
      // descobre próximo rowid sobrevivente pulando blocos
      let advanced = false;
      for (const skip of [10, 100, 1000, 10000]) {
        try {
          const probe = db.prepare(`SELECT rowid FROM "${table}" WHERE rowid > ? ORDER BY rowid LIMIT 1`).all(lo + skip);
          if (probe.length) {
            lo = probe[0].rowid - 1;
            advanced = true;
            break;
          }
        } catch {}
      }
      if (!advanced) break;
      continue;
    }
    if (!batch.length) break;
    out.push(...batch);
    lo = batch[batch.length - 1].rowid;
  }
  return out;
}

const colsInfo = dst.prepare('PRAGMA table_info("Work")').all().map((c) => c.name);
const placeholders = colsInfo.map(() => "?").join(",");
const insWork = dst.prepare(`INSERT OR IGNORE INTO "Work" (${colsInfo.map((c) => `"${c}"`).join(",")}) VALUES (${placeholders})`);

const countRow = src.prepare("SELECT MAX(rowid) AS m FROM Work").get();
const maxRowid = countRow?.m ?? 0;
console.log(`Work: max(rowid) no arquivo corrompido = ${maxRowid}`);

let saved = 0, skippedWindows = 0;
dst.exec("BEGIN");
const WINDOW = 400;
for (let lo = 0; lo < maxRowid; ) {
  const hi = lo + WINDOW;
  let batch;
  try {
    batch = src.prepare("SELECT * FROM Work WHERE rowid > ? AND rowid <= ? ORDER BY rowid").all(lo, hi);
  } catch {
    // janela com corrupção: tenta linha a linha
    batch = [];
    for (let r = lo + 1; r <= hi; r++) {
      try {
        const one = src.prepare("SELECT * FROM Work WHERE rowid = ?").get(r);
        if (one) batch.push(one);
      } catch {
        skippedWindows++;
      }
    }
  }
  for (const r of batch) {
    try {
      insWork.run(...colsInfo.map((c) => r[c]));
      saved++;
    } catch {}
  }
  lo = hi;
}
dst.exec("COMMIT");
console.log(`OK Work: ${saved} obras salvas, ${skippedWindows} linhas perdidas em páginas corrompidas`);

// ---------- 3) validação ----------
const counts = {};
for (const t of [...SMALL, "Work"]) {
  counts[t] = dst.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
}
console.log("Contagens no banco recuperado:", JSON.stringify(counts));
const ic = dst.prepare("PRAGMA integrity_check").get();
console.log("integrity_check (novo banco):", JSON.stringify(ic));
dst.close();
src.close();
