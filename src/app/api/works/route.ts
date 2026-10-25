import { NextRequest, NextResponse } from "next/server";
import { getAllWorks, filterWorks, getFacets } from "@/lib/works";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const all = await getAllWorks();
    const facets = getFacets(all);
    const { items, total } = filterWorks(all, {
      type: sp.get("type") ?? undefined,
      genre: sp.get("genre") ?? undefined,
      tag: sp.get("tag") ?? undefined,
      status: sp.get("status") ?? undefined,
      lang: sp.get("lang") ?? undefined,
      q: sp.get("q") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      perPage: Number(sp.get("perPage") ?? 24),
    });
    return NextResponse.json({ ok: true, items, total, facets });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
