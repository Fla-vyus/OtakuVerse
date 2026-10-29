// Detalhes em lote (biblioteca) — evita N requests.
// v4.0: consulta SQL direta por ids (sem pool em memória). ≤200 ids por chamada.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parseWork } from "@/lib/types";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const ids = (req.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 200);
    if (!ids.length) return NextResponse.json({ ok: true, items: [] });

    const user = await getSessionUser();
    const adult = !!user?.adultMode;
    // SQL por ids (chave primária — barato). Dramas fora do catálogo; adulto só com modo +18.
    const rows = await db.work.findMany({
      where: { id: { in: ids }, type: { not: "drama" } },
    });
    const items = rows
      .map((r) => parseWork(r))
      .filter((w) => w.classification !== "adult" || adult);
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
