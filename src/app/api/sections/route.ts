// As 5 seções da home: Lançamentos, Bombando (<5 caps), Mais Buscados (proxy de vendas),
// estreias da semana (para o calendário teaser) e itens de notícias recentes.
import { NextResponse } from "next/server";
import { getAllWorks } from "@/lib/works";
import { buildNews } from "@/lib/news";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __sectionsCache?: { at: number; data: any } };
const TTL = 5 * 60_000;

export async function GET() {
  if (g.__sectionsCache && Date.now() - g.__sectionsCache.at < TTL) {
    return NextResponse.json({ ok: true, ...g.__sectionsCache.data, cached: true });
  }
  const all = await getAllWorks();
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);

  // 1) Lançamentos recentes (últimos 120 dias, com capa, ordenado por popularidade)
  const launches = all
    .filter((w) => (w.startDate ?? "") >= daysAgo(120) && w.cover && (w.popularity ?? 0) >= 300)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 24);

  // 2) Bombando: novos hits em andamento — estreias recentes com tração OU poucos caps publicados
  let hits = all
    .filter((w) => w.status === "RELEASING" && (w.type === "manga" || w.type === "manhwa" || w.type === "manhua"))
    .filter(
      (w) =>
        (w.chapters != null && w.chapters <= 5) ||
        ((w.startDate ?? "9999") >= daysAgo(540) && (w.popularity ?? 0) >= 3000)
    )
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 24);
  // fallback: se ainda pouco, completa com RELEASING mais populares do momento
  if (hits.length < 10) {
    const extra = all
      .filter((w) => w.status === "RELEASING" && (w.type === "manga" || w.type === "manhwa" || w.type === "manhua") && !hits.some((h) => h.id === w.id))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24 - hits.length);
    hits = [...hits, ...extra];
  }

  // 3) Mais buscados (proxy honesto de vendas: popularidade global)
  const bestsellers = [...all].sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)).slice(0, 24);

  // 4) Obras-primas (melhores notas de todos os tempos)
  const masterpieces = all
    .filter((w) => (w.avgScore ?? 0) >= 80 && w.cover)
    .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
    .slice(0, 24);

  // 5) Ecchi/Sensorial em alta (gosto do usuário: ecchi + boa arte + história)
  const ecchiHits = all
    .filter((w) => w.classification === "suggestive" && w.cover)
    .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))
    .slice(0, 24);

  // 6) Manhwas em alta (KR)
  const manhwaHits = all
    .filter((w) => w.type === "manhwa" && w.cover)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 24);

  // 7) Animes do momento
  const animePicks = all
    .filter((w) => w.type === "anime" && w.cover)
    .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))
    .slice(0, 24);

  // 8) Dramas em destaque (KR/CN/JP/TH)
  const dramaPicks = all
    .filter((w) => w.type === "drama" && w.cover)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 24);

  // 4) Estreias do mês (calendário teaser)
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthLaunches = all
    .filter((w) => (w.startDate ?? "").startsWith(monthKey) && w.cover)
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 12);

  // 5) Notícias (dados reais do dia)
  const news = await buildNews(all).catch(() => []);

  const data = {
    launches,
    hits,
    bestsellers,
    masterpieces,
    ecchiHits,
    manhwaHits,
    animePicks,
    dramaPicks,
    monthLaunches,
    news,
    counts: { total: all.length },
  };
  g.__sectionsCache = { at: Date.now(), data };
  return NextResponse.json({ ok: true, ...data });
}
