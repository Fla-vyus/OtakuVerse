import { NextResponse } from "next/server";
import { getWeeklyReleases } from "@/lib/schedule";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getWeeklyReleases();
    return cachedJson({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
