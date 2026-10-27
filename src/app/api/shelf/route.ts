import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseWork } from "@/lib/types";

export const dynamic = "force-dynamic";

export const SHELF_STATUSES = ["READING", "PLANNING", "COMPLETED", "FAVORITE", "PAUSED", "DROPPED"] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const entries = await db.shelfEntry.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } });
    const ids = entries.map((e) => e.workId);
    const works = await db.work.findMany({ where: { id: { in: ids } } });
    const wmap = new Map(works.map((w) => [w.id, parseWork(w)]));
    const out = entries
      .map((e) => ({ ...e, work: wmap.get(e.workId) ?? null }))
      .filter((e) => e.work);
    return NextResponse.json({ ok: true, entries: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const body = await req.json();
    const workId = String(body.workId ?? "");
    if (!workId) return NextResponse.json({ ok: false, error: "workId obrigatório" }, { status: 400 });
    const exists = await db.work.findUnique({ where: { id: workId } });
    if (!exists) return NextResponse.json({ ok: false, error: "obra não encontrada" }, { status: 404 });

    // toggle: mesmo status → remove
    const current = await db.shelfEntry.findUnique({ where: { userId_workId: { userId: user.id, workId } } });
    const status = String(body.status ?? "PLANNING");
    if (current && !body.force && current.status === status && body.rating === undefined && body.note === undefined && body.progress === undefined) {
      await db.shelfEntry.delete({ where: { id: current.id } });
      return NextResponse.json({ ok: true, removed: true });
    }
    const entry = await db.shelfEntry.upsert({
      where: { userId_workId: { userId: user.id, workId } },
      create: { userId: user.id, workId, status, rating: body.rating ?? null, note: body.note ?? null, progress: body.progress ?? 0 },
      update: {
        ...(body.status !== undefined ? { status } : {}),
        ...(body.rating !== undefined ? { rating: body.rating } : {}),
        ...(body.note !== undefined ? { note: body.note } : {}),
        ...(body.progress !== undefined ? { progress: body.progress } : {}),
      },
    });
    return NextResponse.json({ ok: true, entry });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const workId = req.nextUrl.searchParams.get("workId") ?? "";
    await db.shelfEntry.deleteMany({ where: { userId: user.id, workId } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
