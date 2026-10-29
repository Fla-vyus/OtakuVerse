// v4.0 — ETAPA 2: refresh ADMIN protegido por token. ÚNICO caminho para
// reconstruir a home_cache (e o índice FTS de busca) no ambiente publicado.
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
