import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["reading", "completed", "plan", "paused", "dropped", "favorite"]);

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const items = await db.libraryItem.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    ok: true,
    items: items.map((i) => ({ workId: i.workId, status: i.status, rating: i.rating, note: i.note, updatedAt: i.updatedAt.toISOString() })),
    syncedAt: new Date().toISOString(),
  });
}

/** Sync push: cliente envia seus itens (mesclagem last-write-wins por updatedAt) */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  try {
    if (!rateLimitPost(req)) return NextResponse.json({ ok: false, error: "Muitas syncs. Aguarde." }, { status: 429 });
    const body = await req.json().catch(() => ({}));
    const items: any[] = Array.isArray(body.items) ? body.items.slice(0, 5000) : [];
    let pushed = 0, conflicts = 0;

    for (const it of items) {
      const workId = String(it.workId ?? "");
      if (!workId || workId.length > 64) continue;
      const status = STATUSES.has(it.status) ? it.status : "plan";
      const rating = Number.isInteger(it.rating) && it.rating >= 0 && it.rating <= 10 ? it.rating : null;
      const note = typeof it.note === "string" ? it.note.slice(0, 1000) : null;
      const clientUpdatedAt = it.updatedAt ? new Date(it.updatedAt) : null;
      if (clientUpdatedAt && (isNaN(clientUpdatedAt.getTime()) || clientUpdatedAt.getTime() > Date.now() + 60000)) continue;

      const existing = await db.libraryItem.findUnique({ where: { userId_workId: { userId: user.id, workId } } });
      if (!existing) {
        await db.libraryItem.create({
          data: {
            userId: user.id, workId, status, rating, note,
            updatedAt: clientUpdatedAt ?? new Date(),
          },
        });
        pushed++;
      } else if (!clientUpdatedAt || clientUpdatedAt.getTime() > existing.updatedAt.getTime()) {
        await db.libraryItem.update({
          where: { userId_workId: { userId: user.id, workId } },
          data: { status, rating, note, updatedAt: clientUpdatedAt ?? new Date() },
        });
        pushed++;
      } else if (clientUpdatedAt.getTime() < existing.updatedAt.getTime()) {
        conflicts++; // servidor mais novo — cliente vai receber no pull
      }
    }
    await db.eventLog.create({ data: { userId: user.id, kind: "sync_push", payload: JSON.stringify({ pushed, conflicts, received: items.length }) } });
    return NextResponse.json({ ok: true, pushed, conflicts });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Não autenticado" }, { status: 401 });
  const workId = req.nextUrl.searchParams.get("workId");
  if (workId) {
    await db.libraryItem.deleteMany({ where: { userId: user.id, workId } });
  } else {
    await db.libraryItem.deleteMany({ where: { userId: user.id } });
  }
  await db.eventLog.create({ data: { userId: user.id, kind: "sync_delete", payload: workId ?? "ALL" } });
  return NextResponse.json({ ok: true });
}

function rateLimitPost(req: NextRequest): boolean {
  // burst amigável: 6 syncs por 15s por IP — cliques rápidos (favorito, lendo, nota)
  // NUNCA mais recebem 429; abuso sustained continua bloqueado.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `lib:${ip}`;
  const now = Date.now();
  const g = globalThis as unknown as { __libRL?: Map<string, { n: number; reset: number }> };
  if (!g.__libRL) g.__libRL = new Map();
  const b = g.__libRL.get(key);
  if (!b || b.reset < now) {
    g.__libRL.set(key, { n: 1, reset: now + 15_000 });
    return true;
  }
  b.n++;
  return b.n <= 6;
}
