import { NextRequest, NextResponse } from "next/server";
import { getWorkById, getAllWorks, computeRelatedCached } from "@/lib/works";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getSessionUser();
    const adult = !!user?.adultMode;
    const work = await getWorkById(id, adult);
    if (!work) return NextResponse.json({ ok: false, error: "Obra não encontrada" }, { status: 404 });
    if (work.classification === "adult" && !(user?.adultMode && user.adultConsent)) {
      return NextResponse.json({ ok: false, error: "Conteúdo +18 bloqueado. Ative o Modo Adulto no perfil." }, { status: 403 });
    }
    const all = await getAllWorks(adult);
    // gating do related preservado: obra safe nunca mostra related adulto, mesmo em modo +18
    const relPool = work.classification === "adult" ? all : all.filter((w) => w.classification !== "adult");
    // related com LRU + projeção de card (o client renderiza com WorkCard)
    // → resposta ~10x menor e hit instantâneo em visitas repetidas
    const related = await computeRelatedCached(work, relPool, adult);
    return NextResponse.json({ ok: true, work, related });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
