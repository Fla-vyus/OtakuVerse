import { NextResponse } from "next/server";
import { getStreamingSchedule } from "@/lib/schedule";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getStreamingSchedule();
    return cachedJson({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
