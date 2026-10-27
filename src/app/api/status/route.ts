// Status público do site: tamanho do catálogo e última atualização automática
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __statusCache?: { at: number; data: any } };

export async function GET() {
  if (g.__statusCache && Date.now() - g.__statusCache.at < 60_000) {
    return NextResponse.json({ ok: true, ...g.__statusCache.data });
  }
  try {
    const [total, lastCron] = await Promise.all([
      db.work.count({ where: { type: { not: "drama" } } }),
      db.eventLog.findFirst({ where: { kind: "cron_refresh" }, orderBy: { at: "desc" } }),
    ]);
    const data = {
      total,
      lastRefreshAt: lastCron?.at?.toISOString() ?? null,
    };
    g.__statusCache = { at: Date.now(), data };
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: true, total: null, lastRefreshAt: null });
  }
}
