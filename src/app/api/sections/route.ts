// Seções da home: Lançamentos, Mangás Novos, Capítulos da semana, Bombando (<5 caps),
// Bestsellers, Obras-Primas, Manhwas, Ecchi, Animes, Agenda do mês e Notícias.
// (Dramas removidos do catálogo a pedido do usuário)
//
// ISOLAMENTO + PERFORMANCE:
//  - Nunca responde 500: em erro de banco devolve o cache (mesmo stale) ou {ok:false} em 200,
//    para o cliente mostrar estado de erro com botão "tentar novamente" (em vez de home vazia eterna).
//  - Payload enxuto: cards só precisam de ~12 campos — synopsis/extLinks/authors/synonyms
//    (a parte pesada, ~80% do tamanho) ficam de fora e o detalhe continua carregando o objeto completo.
//  - Resposta em gzip automática do Next quando >1KB (agora cai bem abaixo disso).
import { NextRequest, NextResponse } from "next/server";
import { getAllWorks, estimateChapterReleases, toCardWork } from "@/lib/works";
import { buildNews } from "@/lib/news";
import type { WorkData } from "@/lib/types";
import { cachedJson, cachedVolatile } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __sectionsCache?: { at: number; data: any } };
const TTL = 5 * 60_000;

const BOOK_TYPES = ["manga", "manhwa", "manhua"];

function project<T>(list: T[]): T[] {
  // listas de obras passam pela projeção de card; entradas compostas (ex.: chapterReleases) ficam como estão
  return list.map((item: any) =>
    item && typeof item === "object" && "id" in item && "type" in item && "cover" in item ? toCardWork(item) : item
  );
}

function emptyData(msg: string) {
  return {
    ok: false as const,
    error: msg,
    launches: [], newMangas: [], chapterReleases: [], hits: [], bestsellers: [],
    masterpieces: [], ecchiHits: [], manhwaHits: [], animePicks: [], monthLaunches: [],
    news: [], counts: { total: 0 },
  };
}

export async function GET(req: NextRequest) {
  const allowEmpty = req.nextUrl.searchParams.get("soft") === "1";
  if (g.__sectionsCache && Date.now() - g.__sectionsCache.at < TTL) {
    return cachedVolatile({ ok: true, ...g.__sectionsCache.data, cached: true });
  }

  let all: WorkData[];
  try {
    all = await getAllWorks();
  } catch {
    // banco ocupado/falhou → serve o último cache de seções válido (mesmo stale)
    if (g.__sectionsCache?.data) return cachedJson({ ok: true, ...g.__sectionsCache.data, cached: true, stale: true });
    // sem nada em memória: resposta soft para o cliente mostrar painel de erro com retry (200, nunca 500)
    return NextResponse.json(emptyData(allowEmpty ? "Catálogo aquecendo — tente novamente em instantes" : "Catálogo indisponível agora"), { status: 200 });
  }

  try {
    const now = Date.now();
    const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    // 1) Lançamentos recentes (últimos 120 dias, com capa, ordenado por popularidade)
    const launches = all
      .filter((w) => (w.startDate ?? "") >= daysAgo(120) && (w.startDate ?? "") <= today && w.cover && (w.popularity ?? 0) >= 300)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24);

    // 2) Mangás novos — começaram a publicar há pouco tempo (mangá/manhwa/manhua, SEM datas futuras)
    let newMangas = all
      .filter((w) => BOOK_TYPES.includes(w.type) && w.cover && (w.startDate ?? "") >= daysAgo(120) && (w.startDate ?? "") <= today)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
      .slice(0, 24);
    if (newMangas.length < 8) {
      // janela maior para nunca ficar vazio
      newMangas = all
        .filter((w) => BOOK_TYPES.includes(w.type) && w.cover && (w.startDate ?? "") >= daysAgo(365) && (w.startDate ?? "") <= today)
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
        .slice(0, 24);
    }

    // 3) Capítulos chegando — séries ativas com ritmo semanal estimado (helper central)
    const chapterReleases = estimateChapterReleases(all, 48);

    // 4) Bombando: novos hits em andamento — estreias recentes com tração OU poucos caps publicados
    let hits = all
      .filter((w) => w.status === "RELEASING" && BOOK_TYPES.includes(w.type))
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
        .filter((w) => w.status === "RELEASING" && BOOK_TYPES.includes(w.type) && !hits.some((h) => h.id === w.id))
        .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        .slice(0, 24 - hits.length);
      hits = [...hits, ...extra];
    }

    // 5) Mais buscados (proxy honesto de vendas: favoritos globais)
    const bestsellers = [...all].sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)).slice(0, 24);

    // 6) Obras-primas (melhores notas de todos os tempos)
    const masterpieces = all
      .filter((w) => (w.avgScore ?? 0) >= 80 && w.cover)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0))
      .slice(0, 24);

    // 7) Ecchi/Sensorial em alta (gosto do usuário: ecchi + boa arte + história)
    //    Ecchi DE VERDADE: gênero oficial "Ecchi" da AniList (dado primário) ou fan-service
    //    pervasivo (Nudity rank >= 75). Antes bastava classification=suggestive — obras com
    //    cenas pontuais de nudez (Berserk 66, Chainsaw Man 57, Evangelion 55, Black Clover 45)
    //    dominavam a fileira por favoritos e viravam recomendação errada; o rank de Nudity não
    //    separa (Mushoku P2 tem 41 e é ecchi), só o gênero separa (891 obras no acervo).
    //    Dedupe de franquia: mangá+anime da mesma série não podem ocupar 2 cards.
    const isRealEcchi = (w: WorkData) =>
      w.genres.includes("Ecchi") || w.tags.some((t) => t.name === "Nudity" && t.rank >= 75);
    const franquia = (w: WorkData) => {
      const base = w.title.split(/[:(/]/)[0].toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
      // sequências: "Mushoku Tensei II", "... Part 2", "Code Geass ... R2", "Temporada 3" → mesma base
      return base.replace(/ (part|season|temporada|s)?\s*(i{1,3}|iv|vi{1,3}|xi{0,3}|\d+|r\d+)$/i, "").trim() || base;
    };
    const seenFranchise = new Set<string>();
    const ecchiHits: WorkData[] = [];
    for (const w of all
      .filter((x) => x.classification === "suggestive" && x.cover && isRealEcchi(x))
      .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))) {
      const key = franquia(w);
      if (seenFranchise.has(key)) continue;
      seenFranchise.add(key);
      ecchiHits.push(w);
      if (ecchiHits.length >= 24) break;
    }
    // segurança: acervo pequeno → completa com o resto do suggestive (nunca fica vazia)
    if (ecchiHits.length < 24) {
      for (const w of all
        .filter((x) => x.classification === "suggestive" && x.cover)
        .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))) {
        if (ecchiHits.length >= 24) break;
        const key = franquia(w);
        if (seenFranchise.has(key)) continue;
        seenFranchise.add(key);
        ecchiHits.push(w);
      }
    }

    // 8) Manhwas em alta (KR)
    const manhwaHits = all
      .filter((w) => w.type === "manhwa" && w.cover)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24);

    // 9) Animes do momento
    const animePicks = all
      .filter((w) => w.type === "anime" && w.cover)
      .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))
      .slice(0, 24);

    // 10) Estreias do mês (calendário teaser)
    const monthKey = new Date().toISOString().slice(0, 7);
    const monthLaunches = all
      .filter((w) => (w.startDate ?? "").startsWith(monthKey) && w.cover)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 12);

    // 11) Notícias (dados reais do dia — fonte dupla AniList→Kitsu, nunca derruba a rota)
    const news = await buildNews(all).catch(() => []);

    const data = {
      launches: project(launches),
      newMangas: project(newMangas),
      chapterReleases: chapterReleases.map((r) => ({ ...r, work: toCardWork(r.work) })),
      hits: project(hits),
      bestsellers: project(bestsellers),
      masterpieces: project(masterpieces),
      ecchiHits: project(ecchiHits),
      manhwaHits: project(manhwaHits),
      animePicks: project(animePicks),
      monthLaunches: project(monthLaunches),
      news,
      counts: { total: all.length },
    };
    g.__sectionsCache = { at: Date.now(), data };
    return cachedVolatile({ ok: true, ...data });
  } catch (e: any) {
    // erro de processamento → stale se houver, senão soft-fail
    if (g.__sectionsCache?.data) return cachedJson({ ok: true, ...g.__sectionsCache.data, cached: true, stale: true });
    return NextResponse.json(emptyData(String(e?.message ?? "erro ao montar seções")), { status: 200 });
  }
}
