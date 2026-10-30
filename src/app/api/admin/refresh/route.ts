// v4.0 — ETAPA 2: refresh ADMIN protegido por token. ÚNICO caminho para
// reconstruir a home_cache, o índice FTS de busca e as auxiliares
// WorkGenre/WorkTag no ambiente publicado.
// Chamada: GET/POST /api/admin/refresh?token=SECRET — manual ou por cron externo.
// NUNCA chamado por setInterval/tarefa interna do servidor (regra da plataforma
// com pouca RAM: nada de trabalho pesado em background dentro do processo).
//
// Token: env ADMIN_TOKEN (ou via otakuverse.runtime.json). Comparação em tempo
// constante. Sem token configurado → 503 (falha explícita, nunca aberto).
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { refreshHomeCache } from "@/lib/homecache";
import { isRemoteDb } from "@/lib/runtime-env";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function tokenOk(provided: string | null): boolean {
  const expected = process.env.ADMIN_TOKEN ?? "";
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: NextRequest) {
  const provided = req.nextUrl.searchParams.get("token") ?? req.headers.get("x-admin-token");
  if (!tokenOk(provided)) {
    return NextResponse.json({ ok: false, error: "Token admin ausente ou inválido" }, { status: process.env.ADMIN_TOKEN ? 401 : 503 });
  }
  const t0 = Date.now();
  const steps: Record<string, unknown> = {};
  try {
    // 1) home_cache (seções pré-calculadas da home)
    const home = await refreshHomeCache();
    steps.homeCache = { ok: true, at: home.at };
  } catch (e: any) {
    steps.homeCache = { ok: false, error: String(e?.message ?? e).slice(0, 160) };
  }
  try {
    // 2) FTS5 da busca (só em modo remoto — a tabela não existe no SQLite local de dev)
    if (isRemoteDb) {
      await db.$queryRawUnsafe(`CREATE VIRTUAL TABLE IF NOT EXISTS work_fts USING fts5(workId UNINDEXED, text)`);
      await db.$queryRawUnsafe(`DELETE FROM work_fts`);
      await db.$queryRawUnsafe(
        `INSERT INTO work_fts(workId, text)
         SELECT "id", "title" || ' ' || COALESCE("titleEn",'') || ' ' || COALESCE("titleNative",'') || ' ' || COALESCE("synonyms",'') || ' ' || COALESCE("authors",'')
         FROM "Work" WHERE "classification" != 'adult' AND "type" != 'drama'`
      );
      const rows = await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) as n FROM work_fts`);
      steps.fts = { ok: true, docs: Number(rows[0]?.n ?? 0) };
    } else {
      steps.fts = { ok: true, skipped: "modo local (file)" };
    }
  } catch (e: any) {
    steps.fts = { ok: false, error: String(e?.message ?? e).slice(0, 160) };
  }
  try {
    // 3) WorkGenre/WorkTag — sincroniza as tabelas auxiliares com o JSON de
    //    Work (mesmo SQL da fonte única scripts/lib-aux-tables.mjs, aqui via
    //    Prisma raw para não abrir uma segunda conexão no container).
    //    Rebuild por janelas de rowid: DELETE+INSERT atômicos, nunca zera as
    //    tabelas de uma vez; json_valid() protege o json_each de linhas ruins.
    if (isRemoteDb) {
      const DDL_AUX = [
        `CREATE TABLE IF NOT EXISTS WorkGenre (workId TEXT NOT NULL, genre TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS WorkTag (workId TEXT NOT NULL, name TEXT NOT NULL, rank INTEGER)`,
        `CREATE INDEX IF NOT EXISTS WorkGenre_genre_workId_idx ON WorkGenre("genre","workId")`,
        `CREATE INDEX IF NOT EXISTS WorkGenre_workId_idx ON WorkGenre("workId")`,
        `CREATE INDEX IF NOT EXISTS WorkTag_name_workId_idx ON WorkTag("name","workId")`,
        `CREATE INDEX IF NOT EXISTS WorkTag_workId_idx ON WorkTag("workId")`,
      ];
      for (const sql of DDL_AUX) await db.$queryRawUnsafe(sql);
      const mres = await db.$queryRawUnsafe<{ m: number }[]>(`SELECT COALESCE(MAX(rowid), 0) AS m FROM "Work"`);
      const maxRowid = Number(mres[0]?.m ?? 0);
      const WINDOW = 4000;
      let windows = 0;
      for (let start = 1; start <= maxRowid; start += WINDOW) {
        const end = start + WINDOW;
        await db.$queryRawUnsafe(
          `DELETE FROM WorkGenre WHERE workId IN (SELECT "id" FROM "Work" WHERE rowid >= ? AND rowid < ?)`,
          start, end
        );
        await db.$queryRawUnsafe(
          `DELETE FROM WorkTag WHERE workId IN (SELECT "id" FROM "Work" WHERE rowid >= ? AND rowid < ?)`,
          start, end
        );
        await db.$queryRawUnsafe(
          `INSERT INTO WorkGenre(workId, genre)
           SELECT DISTINCT w."id", j.value
           FROM (SELECT "id", "genres" FROM "Work"
                 WHERE rowid >= ? AND rowid < ?
                   AND "genres" IS NOT NULL AND json_valid("genres") AND "genres" LIKE '[%') w,
                json_each(w."genres") j
           WHERE j.type = 'text' AND TRIM(j.value) != ''`,
          start, end
        );
        await db.$queryRawUnsafe(
          `INSERT INTO WorkTag(workId, name, rank)
           SELECT DISTINCT w."id", json_extract(t.value, '$.name'), CAST(json_extract(t.value, '$.rank') AS INTEGER)
           FROM (SELECT "id", "tags" FROM "Work"
                 WHERE rowid >= ? AND rowid < ?
                   AND "tags" IS NOT NULL AND json_valid("tags") AND "tags" LIKE '[%') w,
                json_each(w."tags") t
           WHERE json_type(t.value) = 'object'
             AND COALESCE(json_extract(t.value, '$.name'), '') != ''`,
          start, end
        );
        windows++;
      }
      const cnt = await db.$queryRawUnsafe<{ wg: number; wt: number }[]>(
        `SELECT (SELECT COUNT(*) FROM WorkGenre) AS wg, (SELECT COUNT(*) FROM WorkTag) AS wt`
      );
      steps.aux = {
        ok: true,
        windows,
        workGenre: Number(cnt[0]?.wg ?? 0),
        workTag: Number(cnt[0]?.wt ?? 0),
      };
    } else {
      steps.aux = { ok: true, skipped: "modo local (file)" };
    }
  } catch (e: any) {
    steps.aux = { ok: false, error: String(e?.message ?? e).slice(0, 160) };
  }
  const ok = Object.values(steps).every((s: any) => s?.ok !== false);
  return NextResponse.json(
    { ok, ms: Date.now() - t0, steps, at: new Date().toISOString() },
    { status: ok ? 200 : 207 }
  );
}

export async function GET(req: NextRequest) {
  return run(req);
}
export async function POST(req: NextRequest) {
  return run(req);
}
