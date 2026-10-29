// v4.0 — Explorar/Busca: SQL DIRETO no Turso (sem pool em memória).
// Paginação LIMIT/OFFSET (24/página), índices de popularidade/tipo/gênero/título,
// busca por FTS5 com fallback LIKE. Facets via agregação SQL com cache pequeno.
import { NextRequest, NextResponse } from "next/server";
import { queryWorksSql, getFacetsSql, catalogSizeSql, PER_PAGE_DEFAULT } from "@/lib/works-sql";
import { getSessionUser } from "@/lib/auth";
import { gzipJson } from "@/lib/httpCache";

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
    const page = Number(sp.get("page") ?? 1);
    const perPage = Number(sp.get("perPage") ?? PER_PAGE_DEFAULT);
    const [{ items, total }, facets, catalogSize] = await Promise.all([
      queryWorksSql({
        type: sp.get("type") ?? undefined,
        genre: sp.get("genre") ?? undefined,
        tag: sp.get("tag") ?? undefined,
        status: sp.get("status") ?? undefined,
        lang: sp.get("lang") ?? undefined,
        classification: adult ? undefined : sp.get("classification") ?? undefined,
        mag: sp.get("mag") ?? undefined,
        q: sp.get("q") ?? undefined,
        sort: sp.get("sort") ?? undefined,
        page,
        perPage,
        adultZone: adult,
      }),
      getFacetsSql(adult),
      catalogSizeSql(adult),
    ]);
    // gzipJson: cards viajavam CRUS (Next não comprime Route Handlers) — gzip corta ~80%.
    // Sem cache público: rota sensível a sessão (zona adulta).
    return gzipJson({
      ok: true,
      items,
      total,
      facets,
      page,
      perPage,
      catalogSize,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
