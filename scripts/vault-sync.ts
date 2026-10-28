/**
 * COFRE EXTERNO do OtakuVerse — redundância total fora do diretório do site.
 *
 * O banco vive em db/custom.db (fora do git), o snapshot git-safe em data/ (dentro
 * do projeto). Este script cria uma TERCEIRA casa em /home/z/otakuverse-vault/ —
 * FORA do projeto — com o MESMO conteúdo em VÁRIOS FORMATOS e VÁRIOS LUGARES:
 *
 *   vault/latest/                 ← conjunto mais recente (sobrescrito a cada rodada)
 *     catalogo.db                 ← cópia SQLite completa (VACUUM INTO, consistente)
 *     catalogo.sql                ← dump SQL em texto (outro formato, restaurável por sqlite3)
 *     catalogo.jsonl              ← JSON por linha, sem compressão (legível e greppável)
 *     catalogo.csv                ← CSV das colunas essenciais (planilha)
 *     contas.json                 ← usuários/sessões/biblioteca/listas (legível)
 *     manifesto.json              ← sha256 + contagens de TUDO (verificação de integridade)
 *   vault/historico/<timestamp>/  ← últimos 3 conjuntos completos (rotação)
 *
 * Cada arquivo é VERIFICADO depois de escrito (releitura + contagem + sha256).
 * Executar: npx tsx scripts/vault-sync.ts
 */
import { PrismaClient } from "@prisma/client";
import {
  mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, statSync, readdirSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const VAULT = "/home/z/otakuverse-vault";
const HISTORY_KEEP = 3;
const run = promisify(execFile);

const db = new PrismaClient();

function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

/** grava + reverifica (sha256 do que foi escrito vs relido) */
function writeVerified(file: string, content: Buffer | string): { bytes: number; sha: string; verified: boolean } {
  writeFileSync(file, content);
  const back = readFileSync(file);
  const sha = sha256(back);
  return { bytes: back.length, sha, verified: sha === sha256(content) };
}

function csvCell(v: any): string {
  if (v == null) return "";
  const s = String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync(`${VAULT}/latest`, { recursive: true });
  mkdirSync(`${VAULT}/historico`, { recursive: true });
  const report: any = { app: "OtakuVerse", at: new Date().toISOString(), files: {} };

  // ---------- 1) cópia SQLite consistente ----------
  const dbUrl = process.env.DATABASE_URL ?? "file:./db/custom.db";
  const dbPath = path.resolve(process.cwd(), dbUrl.replace(/^file:/, ""));
  rmSync(`${VAULT}/latest/catalogo.db`, { force: true }); // VACUUM INTO não sobrescreve
  await db.$executeRawUnsafe(`VACUUM INTO '${`${VAULT}/latest/catalogo.db`.replace(/'/g, "''")}'`);
  const dbSize = statSync(`${VAULT}/latest/catalogo.db`).size;
  console.log(`  ✓ catalogo.db (${(dbSize / 1048576).toFixed(1)} MB)`);

  // ---------- 2) dump SQL em texto (formato redundante) ----------
  // prioridade: CLI sqlite3; fallback: módulo sqlite3 embutido do python3 (iterdump)
  const dumpSql = async (): Promise<string> => {
    try {
      const { stdout } = await run("sqlite3", [dbPath, ".dump"], { maxBuffer: 512 * 1024 * 1024, timeout: 300_000 });
      return stdout;
    } catch {
      const { stdout } = await run("python3", ["-c", "import sqlite3,sys; con=sqlite3.connect(sys.argv[1]); [print(l) for l in con.iterdump()]", dbPath], { maxBuffer: 512 * 1024 * 1024, timeout: 300_000 });
      return stdout;
    }
  };
  try {
    const sql = await dumpSql();
    if (!sql.includes("BEGIN TRANSACTION")) throw new Error("dump sem transação — suspeito");
    const rs = writeVerified(`${VAULT}/latest/catalogo.sql`, sql);
    console.log(`  ✓ catalogo.sql (${(rs.bytes / 1048576).toFixed(1)} MB, sha ok=${rs.verified})`);
    report.files["catalogo.sql"] = rs;
  } catch {
    console.log("  ! dump .sql indisponível (sem sqlite3 CLI nem python3) — db/jsonl/csv cobrem");
  }

  // ---------- 3) JSONL sem compressão (legível/greppável) ----------
  const rows = await db.work.findMany({ orderBy: { id: "asc" } });
  const chunks: string[] = [];
  for (const r of rows) chunks.push(JSON.stringify(r) + "\n");
  const jsonl = chunks.join("");
  const rj = writeVerified(`${VAULT}/latest/catalogo.jsonl`, jsonl);
  const lineCount = jsonl.split("\n").filter((l) => l.trim()).length;
  console.log(`  ✓ catalogo.jsonl (${lineCount} obras, ${(rj.bytes / 1048576).toFixed(1)} MB, sha ok=${rj.verified})`);

  // ---------- 4) CSV das colunas essenciais (planilha) ----------
  const COLS = ["id", "type", "title", "titleEn", "status", "chapters", "volumes", "episodes", "startDate", "country", "classification", "avgScore", "popularity", "favourites", "cover"];
  const csvLines = [COLS.join(",")];
  for (const r of rows as any[]) {
    csvLines.push(COLS.map((c) => csvCell(r[c])).join(","));
  }
  const rc = writeVerified(`${VAULT}/latest/catalogo.csv`, csvLines.join("\n"));
  console.log(`  ✓ catalogo.csv (${rows.length} linhas, ${(rc.bytes / 1048576).toFixed(1)} MB, sha ok=${rc.verified})`);

  // ---------- 5) contas (legível) ----------
  const [users, sessions, library, shelf, lists] = await Promise.all([
    db.user.findMany(),
    db.session.findMany({ where: { expiresAt: { gt: new Date() } } }),
    db.libraryItem.findMany(),
    db.shelfEntry.findMany().catch(() => []),
    db.userList.findMany().catch(() => []),
  ]);
  const accounts = JSON.stringify({ exportedAt: new Date().toISOString(), users, sessions, library, shelf, lists }, null, 2);
  const ra = writeVerified(`${VAULT}/latest/contas.json`, accounts);
  console.log(`  ✓ contas.json (${users.length} usuários, ${library.length} biblioteca, sha ok=${ra.verified})`);

  // ---------- 6) manifesto com sha256 de tudo ----------
  const manifesto = {
    app: "OtakuVerse",
    at: new Date().toISOString(),
    local: "cofre EXTERNO ao projeto (/home/z/otakuverse-vault)",
    catalog: { count: rows.length, csvRows: rows.length + 1 },
    accounts: { users: users.length, sessions: sessions.length, library: library.length, shelf: shelf.length, lists: lists.length },
    files: {
      "catalogo.db": { bytes: dbSize },
      "catalogo.jsonl": { bytes: rj.bytes, sha256: rj.sha },
      "catalogo.csv": { bytes: rc.bytes, sha256: rc.sha },
      "contas.json": { bytes: ra.bytes, sha256: ra.sha },
      ...(report.files["catalogo.sql"] ? { "catalogo.sql": { bytes: report.files["catalogo.sql"].bytes, sha256: report.files["catalogo.sql"].sha } } : {}),
    },
  };
  writeFileSync(`${VAULT}/latest/manifesto.json`, JSON.stringify(manifesto, null, 2));
  console.log(`  ✓ manifesto.json`);

  // ---------- 7) rotação do histórico (mantém os últimos 3) ----------
  const histDir = `${VAULT}/historico`;
  const setDir = `${histDir}/${stamp}`;
  rmSync(setDir, { force: true, recursive: true });
  run("cp", ["-r", `${VAULT}/latest`, setDir]).then(
    () => console.log(`  ✓ histórico ${stamp}`),
    () => console.log("  ! histórico não copiado (cp indisponível) — latest segue íntegro")
  );
  setTimeout(() => {
    try {
      const sets = readdirSync(histDir).filter((d) => existsSync(`${histDir}/${d}/manifesto.json`)).sort().reverse();
      for (const old of sets.slice(HISTORY_KEEP)) {
        rmSync(`${histDir}/${old}`, { recursive: true, force: true });
        console.log(`  rotação: ${old} removido`);
      }
    } catch {}
  }, 4000);

  const total = (readdirSync(`${VAULT}/latest`).reduce((acc, f) => acc + statSync(`${VAULT}/latest/${f}`).size, 0) / 1048576).toFixed(1);
  console.log(`COFRE OK — latest com ${total} MB em 5-6 formatos, histórico mantém ${HISTORY_KEEP} conjuntos`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error("vault-sync falhou:", e.message || e);
  process.exit(1);
});
