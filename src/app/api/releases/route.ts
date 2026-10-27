import { NextResponse } from "next/server";
import { getWeeklyReleases } from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getWeeklyReleases();
    return NextResponse.json({ ok: true, ...data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
