import { NextRequest, NextResponse } from "next/server";
import { getWorkById, getAllWorks, computeRelated } from "@/lib/works";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const work = await getWorkById(id);
    if (!work) return NextResponse.json({ ok: false, error: "Obra não encontrada" }, { status: 404 });
    const all = await getAllWorks();
    const related = computeRelated(work, all);
    return NextResponse.json({ ok: true, work, related });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
