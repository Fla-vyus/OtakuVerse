import { NextRequest, NextResponse } from "next/server";
import { getAllWorks, filterWorks, getFacets } from "@/lib/works";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const adult = sp.get("zone") === "adult";
    if (adult) {
      const user = await getSessionUser();
      if (!user || !user.adultMode) {
        return NextResponse.json({ ok: false, error: "Zona adulta bloqueada. Ative o Modo +18 no seu perfil." }, { status: 403 });
      }
    }
    const all = await getAllWorks(adult);
    const pool = adult ? all.filter((w) => w.classification === "adult") : all;
    const facets = await getFacets(adult);
    const { items, total } = filterWorks(pool, {
      type: sp.get("type") ?? undefined,
      genre: sp.get("genre") ?? undefined,
      tag: sp.get("tag") ?? undefined,
      status: sp.get("status") ?? undefined,
      lang: sp.get("lang") ?? undefined,
      classification: adult ? undefined : sp.get("classification") ?? undefined,
      mag: sp.get("mag") ?? undefined,
      q: sp.get("q") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      page: Number(sp.get("page") ?? 1),
      perPage: Number(sp.get("perPage") ?? 60),
    });
    return NextResponse.json({
      ok: true,
      items,
      total,
      facets,
      page: Number(sp.get("page") ?? 1),
      perPage: Number(sp.get("perPage") ?? 60),
      catalogSize: pool.length,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
