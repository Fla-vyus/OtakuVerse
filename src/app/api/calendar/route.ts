import { NextResponse } from "next/server";
import { getWeeklyReleases } from "@/lib/schedule";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { days } = await getWeeklyReleases(20);
    return cachedJson({ ok: true, days, generatedAt: new Date().toISOString() });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
