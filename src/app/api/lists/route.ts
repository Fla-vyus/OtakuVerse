import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseWork } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const lists = await db.userList.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const allIds = lists.flatMap((l) => { try { return JSON.parse(l.workIds) as string[]; } catch { return []; } });
    const works = await db.work.findMany({ where: { id: { in: allIds } } });
    const wmap = new Map(works.map((w) => [w.id, parseWork(w)]));
    const out = lists.map((l) => ({
      id: l.id,
      name: l.name,
      emoji: l.emoji,
      description: l.description,
      createdAt: l.createdAt,
      works: (() => { try { return (JSON.parse(l.workIds) as string[]).map((id) => wmap.get(id)).filter(Boolean); } catch { return []; } })(),
    }));
    return NextResponse.json({ ok: true, lists: out });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 40);
    if (!name) return NextResponse.json({ ok: false, error: "nome obrigatório" }, { status: 400 });
    const list = await db.userList.create({
      data: {
        userId: user.id,
        name,
        emoji: String(body.emoji ?? "📚").slice(0, 8),
        description: body.description ? String(body.description).slice(0, 140) : null,
        workIds: JSON.stringify(body.workId ? [String(body.workId)] : []),
      },
    });
    return NextResponse.json({ ok: true, list: { ...list, works: [] } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
