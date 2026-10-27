import { NextRequest, NextResponse } from "next/server";
import { getRanking, type RankMetric, type AdultMode } from "@/lib/works";

export const dynamic = "force-dynamic";

const METRICS: RankMetric[] = ["popular", "score", "favorites", "chapters"];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "all";
    const metric = (METRICS.includes(sp.get("metric") as RankMetric) ? sp.get("metric") : "popular") as RankMetric;
    const adultParam = sp.get("adult");
    const adult: AdultMode = adultParam === "show" || adultParam === "only" ? adultParam : "hide";
    const take = Math.min(96, Math.max(10, Number(sp.get("take") ?? 24)));
    const items = await getRanking(type, metric, adult, take);
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
