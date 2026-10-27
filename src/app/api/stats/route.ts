import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [total, byType, adult, ecchi, hotNew, releasing] = await Promise.all([
      db.work.count(),
      db.work.groupBy({ by: ["type"], _count: { _all: true } }),
      db.work.count({ where: { isAdult: true } }),
      db.work.count({ where: { spicy: 1 } }),
      db.work.count({ where: { chapters: { lte: 5 }, type: { in: ["manga", "manhwa"] } } }),
      db.work.count({ where: { status: "RELEASING" } }),
    ]);
    const sync = await db.syncMeta.findUnique({ where: { id: "anilist" } });
    return NextResponse.json({
      ok: true,
      total,
      byType: Object.fromEntries(byType.map((t) => [t.type, t._count._all])),
      adult, ecchi, hotNew, releasing,
      lastSync: sync?.lastSync ?? 0,
      lastAdded: sync?.added ?? 0,
      lastUpdated: sync?.updated ?? 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
