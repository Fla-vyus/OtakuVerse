import { NextRequest, NextResponse } from "next/server";
import { getRankingSql } from "@/lib/works-sql";
import type { RankMetric, AdultMode } from "@/lib/works";
import { getSessionUser } from "@/lib/auth";
import { gzipJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const METRICS: RankMetric[] = ["popular", "score", "favorites", "chapters"];

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const type = sp.get("type") ?? "all";
    const metric = (METRICS.includes(sp.get("metric") as RankMetric) ? sp.get("metric") : "popular") as RankMetric;
    // Gating +18: mostrar/incluir adulto SÓ com sessão válida e Modo +18 ativo
    const user = await getSessionUser(req);
    const allowed = !!user?.adultMode;
    const adultParam = sp.get("adult");
    const adult: AdultMode = allowed && (adultParam === "show" || adultParam === "only") ? adultParam : "hide";
    const take = Math.min(96, Math.max(10, Number(sp.get("take") ?? 24)));
    const items = await getRankingSql(type, metric, adult, take);
    // gzipJson: ranking com até 96 obras viajava cru (42KB) — gzip corta ~80%.
    // Sem cache público: rota sensível a sessão (gating +18).
    return gzipJson({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
