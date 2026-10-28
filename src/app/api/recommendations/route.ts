import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { parseWork } from "@/lib/types";
import { gzipJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

/** Recomendações por afinidade: usa a biblioteca do usuário (tags/gêneros das obras curtidas) */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const user = await getSessionUser(req);
    // Gating +18: camadas explícitas SÓ com sessão válida e Modo +18 ativo
    const allowed = !!user?.adultMode;
    const adult = sp.get("adult") === "1" && allowed;
    const explicit = adult && sp.get("explicit") === "1" && allowed;
    const seedGenres = (sp.get("genres") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const seedTags = (sp.get("tags") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const excludeIds = (sp.get("exclude") ?? "").split(",").filter(Boolean);

    let weightGenres = new Map<string, number>();
    let weightTags = new Map<string, number>();

    if (user) {
      // pega entradas com rating alto ou concluídas/favoritas
      const entries = await db.shelfEntry.findMany({
        where: { userId: user.id, OR: [{ rating: { gte: 7 } }, { status: { in: ["COMPLETED", "FAVORITE", "READING"] } }] },
        orderBy: { updatedAt: "desc" },
        take: 60,
      });
      if (entries.length) {
        const works = await db.work.findMany({ where: { id: { in: entries.map((e) => e.workId) } } });
        const parsed = works.map(parseWork);
        for (let i = 0; i < parsed.length; i++) {
          const w = parsed[i];
          const e = entries.find((x) => x.workId === w.id)!;
          const wgt = (e.rating ?? 7) + (e.status === "FAVORITE" ? 4 : 0) + (e.status === "READING" ? 1 : 0);
          for (const g of w.genres) weightGenres.set(g, (weightGenres.get(g) ?? 0) + wgt);
          for (const t of w.tags) if (t.rank >= 55) weightTags.set(t.name, (weightTags.get(t.name) ?? 0) + wgt * (t.rank / 100));
        }
      }
    }
    for (const g of seedGenres) weightGenres.set(g, (weightGenres.get(g) ?? 0) + 6);
    for (const t of seedTags) weightTags.set(t, (weightTags.get(t) ?? 0) + 6);

    const hasTaste = weightGenres.size > 0 || weightTags.size > 0;

    // pool de candidatos (com camadas de conteúdo adulto)
    const where: any = {
      ...(adult ? (explicit ? {} : { spicy: { lte: 1 } }) : { isAdult: false }),
      id: { notIn: excludeIds },
    };
    if (hasTaste) {
      const topGenres = [...weightGenres.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([g]) => g);
      where.OR = topGenres.map((g) => ({ genres: { contains: `%${g}%` } }));
    } else {
      where.popularity = { gte: 90000 };
    }
    const pool = await db.work.findMany({ where, orderBy: { popularity: "desc" }, take: 600 });

    const scored = pool.map((w) => {
      const p = parseWork(w);
      let s = 0;
      for (const g of p.genres) s += (weightGenres.get(g) ?? 0) * 1.2;
      for (const t of p.tags) s += (weightTags.get(t.name) ?? 0) * (t.rank / 100);
      s += ((p.avgScore ?? 60) - 70) / 4;
      s += Math.log10(p.popularity ?? 1000) * 0.4;
      return { w: p, s };
    });
    scored.sort((a, b) => b.s - a.s);
    // gzipJson: 14 obras completas com sinopse/tags (70KB cru) — gzip corta ~85%.
    // Sem cache público: depende da biblioteca/sessão do usuário.
    return gzipJson({ ok: true, items: scored.slice(0, 14).map((x) => x.w), taste: hasTaste });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
