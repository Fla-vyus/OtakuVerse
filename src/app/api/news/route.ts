import { NextResponse } from "next/server";
import { getAllWorks } from "@/lib/works";
import { buildNews } from "@/lib/news";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const all = await getAllWorks();
    const items = await buildNews(all).catch(() => []);
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
