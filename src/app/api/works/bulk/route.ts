// Detalhes em lote (biblioteca) — evita N requests
import { NextRequest, NextResponse } from "next/server";
import { getAllWorks } from "@/lib/works";
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
    const all = await getAllWorks(adult);
    const byId = new Map(all.map((w) => [w.id, w]));
    // ids podem estar na zona adulta: tenta no pool adulto se logado
    const items = ids
      .map((id) => byId.get(id))
      .filter((w): w is NonNullable<typeof w> => !!w)
      .filter((w) => w.classification !== "adult" || adult);

    if (items.length < ids.length && adult) {
      const missing = ids.filter((id) => !byId.get(id));
      if (missing.length) {
        const { db } = await import("@/lib/db");
        const rows = await db.work.findMany({ where: { id: { in: missing } } });
        const { parseWork } = await import("@/lib/types");
        for (const r of rows) {
          const w = parseWork(r);
          if (w.classification === "adult") items.push(w);
        }
      }
    }
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
