import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** PATCH: adiciona/remove obra de uma lista custom · DELETE: exclui a lista */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const { id } = await params;
    const list = await db.userList.findUnique({ where: { id } });
    if (!list || list.userId !== user.id) return NextResponse.json({ ok: false, error: "lista não encontrada" }, { status: 404 });
    const body = await req.json();
    let ids: string[] = [];
    try { ids = JSON.parse(list.workIds); } catch {}
    const workId = String(body.workId ?? "");
    const op = body.op ?? "add";
    if (op === "add") {
      if (!ids.includes(workId)) ids.push(workId);
    } else {
      ids = ids.filter((x) => x !== workId);
    }
    const updated = await db.userList.update({ where: { id }, data: { workIds: JSON.stringify(ids) } });
    return NextResponse.json({ ok: true, count: JSON.parse(updated.workIds).length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ ok: false, error: "não autenticado" }, { status: 401 });
    const { id } = await params;
    const list = await db.userList.findUnique({ where: { id } });
    if (!list || list.userId !== user.id) return NextResponse.json({ ok: false, error: "lista não encontrada" }, { status: 404 });
    await db.userList.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
