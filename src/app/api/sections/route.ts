// Seções da home: Lançamentos, Mangás Novos, Capítulos da semana, Bombando (<5 caps),
// Bestsellers, Obras-Primas, Manhwas, Ecchi, Animes, Agenda do mês, Webnovels e Notícias.
// (Dramas removidos do catálogo a pedido do usuário)
//
// CARREGAMENTO EM FASES (v3.5 — o site não carrega tudo de uma vez):
//   ?part=core  → o que está DOBRA VISÍVEL: Notícias + Lançamentos + Mangás Novos + Capítulos
//   ?part=more  → o resto, buscado SÓ quando o usuário rola até a sentinela (IntersectionObserver)
//   sem part    → tudo (compatibilidade com clientes antigos/cache)
// Cada fase tem cache próprio; as duas compartilham o pool em memória (zero custo extra).
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

const g = globalThis as unknown as { __sectionsCache?: { at: number; data: any }; __sectionsCoreCache?: { at: number; data: any }; __sectionsMoreCache?: { at: number; data: any } };
const TTL = 5 * 60_000;

const BOOK_TYPES = ["manga", "manhwa", "manhua"];

// Dedupe de franquia: mangá+anime (ou temporada I/II/III) da MESMA série não podem
// ocupar 2 cards na mesma fileira — "Mushoku Tensei II" e "Mushoku Tensei (mangá)"
// viram uma chave só (título antes de ":"/"(", pontuação fora, sufixo de sequência engolido).
function franquia(w: WorkData): string {
  const base = w.title.split(/[:(/]/)[0].toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  return base.replace(/ (part|season|temporada|s)?\s*(i{1,3}|iv|vi{1,3}|xi{0,3}|\d+|r\d+)$/i, "").trim() || base;
}
function dedupeFranquia(list: WorkData[], max: number): WorkData[] {
  const seen = new Set<string>();
  const out: WorkData[] = [];
  for (const w of list) {
    const key = franquia(w);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
    if (out.length >= max) break;
  }
  return out;
}

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
    webnovelPicks: [], news: [], counts: { total: 0 },
  };
}

/** FASE 1 — o que a home mostra sem rolar nada (primeira dobra). */
async function computeCore(all: WorkData[]) {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  // 1) Lançamentos recentes (últimos 120 dias, com capa, ordenado por popularidade)
  //    Dedupe de franquia: temporada/mangá da mesma série não ocupa 2 cards.
  const launches = dedupeFranquia(
    all
      .filter((w) => (w.startDate ?? "") >= daysAgo(120) && (w.startDate ?? "") <= today && w.cover && (w.popularity ?? 0) >= 300)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    24
  );

  // 2) Mangás novos — SÓ mangá (a fileira se chama "Mangás Novos" e o botão "ver todos"
  //    abre o Explorar filtrado em type=manga; manhwas/manhuas têm suas próprias fileiras).
  //    SEM datas futuras + dedupe de franquia (saga não repete card).
  let newMangas = dedupeFranquia(
    all
      .filter((w) => w.type === "manga" && w.cover && (w.startDate ?? "") >= daysAgo(120) && (w.startDate ?? "") <= today)
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
    24
  );
  if (newMangas.length < 8) {
    // janela maior para nunca ficar vazio
    newMangas = dedupeFranquia(
      all
        .filter((w) => w.type === "manga" && w.cover && (w.startDate ?? "") >= daysAgo(365) && (w.startDate ?? "") <= today)
        .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "")),
      24
    );
  }

  // 3) Capítulos chegando — séries ativas com ritmo semanal estimado (helper central)
  const chapterReleases = estimateChapterReleases(all, 48);

  // 4) Notícias (dados reais do dia — fonte dupla AniList→Kitsu, nunca derruba a rota)
  const news = await buildNews(all).catch(() => []);

  return {
    launches: project(launches),
    newMangas: project(newMangas),
    chapterReleases: chapterReleases.map((r) => ({ ...r, work: toCardWork(r.work) })),
    news,
    counts: { total: all.length },
  };
}

/** FASE 2 — tudo abaixo da dobra, buscado só quando o usuário pede (rolagem). */
function computeMore(all: WorkData[]) {
  const now = Date.now();
  const daysAgo = (n: number) => new Date(now - n * 86400000).toISOString().slice(0, 10);

  // 4) Bombando: novos hits em andamento — estreias recentes com tração OU poucos caps publicados
  let hits = dedupeFranquia(
    all
      .filter((w) => w.status === "RELEASING" && BOOK_TYPES.includes(w.type))
      .filter(
        (w) =>
          (w.chapters != null && w.chapters <= 5) ||
          ((w.startDate ?? "9999") >= daysAgo(540) && (w.popularity ?? 0) >= 3000)
      )
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    24
  );
  // fallback: se ainda pouco, completa com RELEASING mais populares do momento
  if (hits.length < 10) {
    const extra = all
      .filter((w) => w.status === "RELEASING" && BOOK_TYPES.includes(w.type) && !hits.some((h) => h.id === w.id))
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 24 - hits.length);
    hits = [...hits, ...extra];
  }

  // 5) Mais buscados (proxy honesto de vendas: favoritos globais)
  //    Dedupe: ONE PIECE anime + mangá não pode ocupar 2 vagas do top 24.
  const bestsellers = dedupeFranquia(
    [...all].sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)),
    24
  );

  // 6) Obras-primas (melhores notas de todos os tempos)
  const masterpieces = dedupeFranquia(
    all
      .filter((w) => (w.avgScore ?? 0) >= 80 && w.cover)
      .sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0)),
    24
  );

  // 7) Ecchi/Sensorial em alta (gosto do usuário: ecchi + boa arte + história)
  //    Ecchi DE VERDADE: gênero oficial "Ecchi" da AniList (dado primário) ou fan-service
  //    pervasivo (Nudity rank >= 75). Antes bastava classification=suggestive — obras com
  //    cenas pontuais de nudez (Berserk 66, Chainsaw Man 57, Evangelion 55, Black Clover 45)
  //    dominavam a fileira por favoritos e viravam recomendação errada; o rank de Nudity não
  //    separa (Mushoku P2 tem 41 e é ecchi), só o gênero separa (891 obras no acervo).
  //    Dedupe de franquia aplicado via helper central (mesma regra de todas as fileiras).
  const isRealEcchi = (w: WorkData) =>
    w.genres.includes("Ecchi") || w.tags.some((t) => t.name === "Nudity" && t.rank >= 75);
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
  const manhwaHits = dedupeFranquia(
    all
      .filter((w) => w.type === "manhwa" && w.cover)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    24
  );

  // 9) Animes do momento
  const animePicks = dedupeFranquia(
    all
      .filter((w) => w.type === "anime" && w.cover)
      .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)),
    24
  );

  // 10) Estreias do mês (calendário teaser)
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthLaunches = dedupeFranquia(
    all
      .filter((w) => (w.startDate ?? "").startsWith(monthKey) && w.cover)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    12
  );

  // 11) Webnovels em alta (catálogo v3.5 — MangaUpdates, popularity = votos da fonte)
  const webnovelPicks = dedupeFranquia(
    all
      .filter((w) => w.type === "webnovel" && w.cover)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)),
    24
  );

  return {
    hits: project(hits),
    bestsellers: project(bestsellers),
    masterpieces: project(masterpieces),
    ecchiHits: project(ecchiHits),
    manhwaHits: project(manhwaHits),
    animePicks: project(animePicks),
    monthLaunches: project(monthLaunches),
    webnovelPicks: project(webnovelPicks),
  };
}

export async function GET(req: NextRequest) {
  const part = req.nextUrl.searchParams.get("part"); // "core" | "more" | null (tudo)
  const allowEmpty = req.nextUrl.searchParams.get("soft") === "1";

  // cache de fase quente → resposta na hora (mesma política de sempre)
  const cacheFor = part === "core" ? g.__sectionsCoreCache : part === "more" ? g.__sectionsMoreCache : g.__sectionsCache;
  if (cacheFor && Date.now() - cacheFor.at < TTL) {
    return cachedVolatile({ ok: true, part: part ?? undefined, ...cacheFor.data, cached: true });
  }

  let all: WorkData[];
  try {
    all = await getAllWorks();
  } catch {
    // banco ocupado/falhou → serve o último cache de seções válido (mesmo stale)
    if (cacheFor?.data) return cachedJson({ ok: true, part: part ?? undefined, ...cacheFor.data, cached: true, stale: true });
    // sem nada em memória: resposta soft para o cliente mostrar painel de erro com retry (200, nunca 500)
    return NextResponse.json(emptyData(allowEmpty ? "Catálogo aquecendo — tente novamente em instantes" : "Catálogo indisponível agora"), { status: 200 });
  }

  try {
    if (part === "core") {
      const data = await computeCore(all);
      g.__sectionsCoreCache = { at: Date.now(), data };
      return cachedVolatile({ ok: true, part: "core", ...data });
    }
    if (part === "more") {
      const data = computeMore(all);
      g.__sectionsMoreCache = { at: Date.now(), data };
      return cachedVolatile({ ok: true, part: "more", ...data });
    }
    // sem part: tudo (compatibilidade — warm-up e clientes antigos)
    const core = await computeCore(all);
    const more = computeMore(all);
    const data = { ...core, ...more };
    g.__sectionsCache = { at: Date.now(), data };
    return cachedVolatile({ ok: true, ...data });
  } catch (e: any) {
    // erro de processamento → stale se houver, senão soft-fail
    if (cacheFor?.data) return cachedJson({ ok: true, part: part ?? undefined, ...cacheFor.data, cached: true, stale: true });
    return NextResponse.json(emptyData(String(e?.message ?? "erro ao montar seções")), { status: 200 });
  }
}
