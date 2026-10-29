// Servidor: helpers de obra — v4.0 SEM POOL EM MEMÓRIA.
//
// A plataforma publicada tem pouca RAM e sem reinício automático: manter 6.5k
// obras + índice de tags em memória (rss ~230MB só de pool) causava OOM → 502.
// Listas/buscas/filtros agora vivem em src/lib/works-sql.ts (SQL direto no
// Turso). Este arquivo guarda apenas helpers puros e acesso por id:
//   · toCardWork      — projeção de card (sem synopsis/authors/etc.)
//   · getWorkById     — detalhe completo (1 linha indexada, sempre fresco)
//   · classify        — classificação de conteúdo (safe/suggestive/adult)
//   · computeRelated  — similaridade (roda sobre candidatos delimitados do SQL)
//   · estimateChapterReleases — ritmo semanal estimado
// O cache LRU de related fica em ≤200 entradas de cards (~2KB cada).
import { db } from "@/lib/db";
import { parseWork, type WorkData, type Classification } from "@/lib/types";

// ---------- Projeção de card ----------
/** Remove os campos pesados que os cards nunca usam.
 *  synopsis ~70% do peso de um card; authors/extLinks/synonyms/banner fecham o resto;
 *  tags passa por trim (cards usam as 2 primeiras — mantemos 6 por segurança).
 *  O detalhe da obra continua carregando o objeto COMPLETO via /api/works/[id]. */
export function toCardWork(w: WorkData): WorkData {
  return {
    ...w,
    synopsis: null,
    synopsisPT: null,
    synonyms: [],
    authors: [],
    extLinks: [],
    banner: null,
    siteUrl: null,
    ptTags: undefined,
    tags: [...w.tags].sort((a, b) => b.rank - a.rank).slice(0, 6),
  };
}

export async function getWorkById(id: string, adult = false): Promise<WorkData | null> {
  // Detalhe completo direto do banco (1 linha indexada) — sempre fresco.
  let row = await db.work.findUnique({ where: { id } });
  // alias de links antigos: a v2.8 usou ids "anilist-XXXX" — redireciona ao numérico
  if (!row && id.startsWith("anilist-")) {
    row = await db.work.findUnique({ where: { id: id.slice(8) } });
  }
  if (!row) return null;
  const work = parseWork(row);
  // mesmo contrato das listas: sem adultMode não expõe adult; dramas saíram do catálogo
  if (!adult && (work.classification === "adult" || work.type === "drama")) return null;
  return work;
}

// ---------- Classificação ----------
/** Deriva a classificação de conteúdo a partir dos dados da AniList.
 *  `adultTags` já vai serializado (coluna JSON do banco) e `spicy` é a camada
 *  sensorial (0 livre · 1 ecchi/suggestive · 2 adulto) usada pelos filtros. */
export function classify(m: { isAdult?: boolean; format?: string | null; tags?: { name: string; rank: number }[]; genres?: string[] }): { classification: Classification; adultTags: string; spicy: number } {
  if (m.isAdult) {
    const tags = (m.tags ?? []).map((t) => t.name.toLowerCase());
    const adultTags: string[] = [];
    if (m.format === "DOUJIN" || tags.some((t) => t.includes("doujin"))) adultTags.push("Doujin");
    if (tags.some((t) => t.includes("hentai") || t.includes("sex"))) adultTags.push("Hentai");
    if (!adultTags.length) adultTags.push("+18");
    adultTags.push("Adulto");
    return { classification: "adult", adultTags: JSON.stringify([...new Set(adultTags)]), spicy: 2 };
  }
  // gênero "Ecchi" (dado oficial da AniList) ⇒ sugestivo — regra alinhada com o
  // fix-ecchi-genre.ts (sem ela, Kuzu no Honkai/We Never Learn etc. ficavam "safe"
  // e sumiam do filtro Ecchi/Sensorial enquanto obras com cenas pontuais entravam)
  if ((m.genres ?? []).includes("Ecchi")) return { classification: "suggestive", adultTags: "[]", spicy: 1 };
  // v3.8: inferência por tags SÓ com intensidade ALTA (rank 0-100 da AniList).
  // Erro agora é para o lado seguro: só conteúdo genuinamente picante (tags
  // dominantes da obra) vira suggestive.
  const tagRanks = new Map((m.tags ?? []).map((t) => [t.name, t.rank]));
  const ecchi = tagRanks.get("Ecchi") ?? 0;
  const nudity = tagRanks.get("Nudity") ?? 0;
  const sexual = tagRanks.get("Sexual Content") ?? 0;
  const sensual = Math.max(tagRanks.get("Succubus") ?? 0, sexual);
  if (ecchi >= 75 || nudity >= 70 || sensual >= 70) return { classification: "suggestive", adultTags: "[]", spicy: 1 };
  return { classification: "safe", adultTags: "[]", spicy: 0 };
}

// ---------- Similaridade ----------
function tagScore(a: WorkData, b: WorkData): number {
  const bTags = new Map(b.tags.map((t) => [t.name, t.rank]));
  let s = 0;
  for (const t of a.tags) {
    const r2 = bTags.get(t.name);
    if (r2) s += (t.rank * r2) / 10000;
  }
  return s;
}

function genreScore(a: WorkData, b: WorkData): number {
  const bg = new Set(b.genres);
  return a.genres.filter((g) => bg.has(g)).length * 0.9;
}

export interface RelatedBundle {
  similar: WorkData[];
  also: WorkData[];
  byAuthor: { author: string; works: WorkData[] }[];
}

export function computeRelated(target: WorkData, pool: WorkData[]): RelatedBundle {
  const others = pool.filter((w) => w.id !== target.id);
  const scored = others.map((w) => {
    let s = tagScore(target, w) * 1.15 + genreScore(target, w);
    if (w.type === target.type) s += 0.4;
    if (w.country === target.country) s += 0.25;
    s += ((w.avgScore ?? 60) - 60) / 100;
    return { w, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const similar = scored.slice(0, 12).map((x) => x.w);
  const also = scored.slice(12, 24).map((x) => x.w);

  const authorNames = [...new Set(target.authors.map((a) => a.name).filter(Boolean))];
  // um autor prolífico pode casar centenas — cap forte, zero regressão visual
  const byAuthorMap = new Map<string, WorkData[]>();
  for (const a of authorNames) {
    const works = others
      .filter((w) => w.authors.some((x) => x.name === a))
      .sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))
      .slice(0, RELATED_PER_AUTHOR);
    if (works.length > 0) {
      byAuthorMap.set(a, works);
      if (byAuthorMap.size >= RELATED_AUTHOR_CAP) break;
    }
  }
  return { similar, also, byAuthor: [...byAuthorMap.entries()].map(([author, works]) => ({ author, works })) };
}

// ---------- Related com cache LRU pequeno (página de detalhe) ----------
// O pool de candidatos (top-1200 por popularidade via SQL) entra pronto; aqui só
// fica o LRU de resultado — v4.0: 200 entradas × ~2KB de cards ≈ 400KB de RAM.
const RELATED_AUTHOR_CAP = 3;   // no máx. 3 grupos "do mesmo autor" no detalhe
const RELATED_PER_AUTHOR = 12;  // e 12 obras por grupo (o carrossel mostra ~6)
const RELATED_LRU_MAX = 200;    // regra de estabilidade: cache pequeno com limite

const gRel = globalThis as unknown as { __ovRelatedLRU?: Map<string, { ver: number; bundle: RelatedBundle }> };
const relatedLRU: Map<string, { ver: number; bundle: RelatedBundle }> = (gRel.__ovRelatedLRU ??= new Map());

export async function computeRelatedCached(target: WorkData, pool: WorkData[], adult: boolean): Promise<RelatedBundle> {
  const key = `${adult ? "a" : "p"}:${target.id}`;
  const hit = relatedLRU.get(key);
  if (hit) {
    // LRU de verdade: re-inserção move para o fim (Map itera por ordem de inserção)
    relatedLRU.delete(key);
    relatedLRU.set(key, hit);
    return hit.bundle;
  }
  const full = computeRelated(target, pool);
  const bundle: RelatedBundle = {
    similar: full.similar.map(toCardWork),
    also: full.also.map(toCardWork),
    byAuthor: full.byAuthor.map((gr) => ({ author: gr.author, works: gr.works.map(toCardWork) })),
  };
  if (relatedLRU.size >= RELATED_LRU_MAX) {
    const oldest = relatedLRU.keys().next().value;
    if (oldest !== undefined) relatedLRU.delete(oldest);
  }
  relatedLRU.set(key, { ver: 0, bundle });
  return bundle;
}

// ---------- Lançamentos de capítulos (ritmo semanal estimado) ----------
export interface ChapterEstimate {
  work: WorkData;
  nextChapter: number | null; // null = AniList não contabiliza (mostra "novo capítulo")
  dateISO: string;
  weekday: string;
  stale: boolean; // última atualização antiga → ritmo só estimado
}

const WD_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const WD_SCHEDULE: [RegExp, number][] = [
  [/domingo/i, 0], [/segunda/i, 1], [/ter[çc]a/i, 2], [/quarta/i, 3], [/quinta/i, 4], [/sexta/i, 5], [/s[áa]bado/i, 6],
];

/** Séries em lançamento (mangá/manhwa/manhua) com próximo capítulo estimado.
 *  Dia da semana: usa o calendário real da revista quando conhecido (ex.: "Semanal (quinta)");
 *  nas demais, distribuição estável e explícitamente rotulada como estimativa. */
export function estimateChapterReleases(pool: WorkData[], limit = 48): ChapterEstimate[] {
  const now = Date.now();
  const picked = pool
    .filter(
      (w) =>
        (w.type === "manga" || w.type === "manhwa" || w.type === "manhua") &&
        w.status === "RELEASING" &&
        !!w.lastUpdate &&
        !!w.cover
    )
    .map((w) => ({ w, fresh: now - w.lastUpdate! * 1000 < 60 * 86400000 }))
    .sort((a, b) => Number(b.fresh) - Number(a.fresh) || (b.w.popularity ?? 0) - (a.w.popularity ?? 0))
    .slice(0, limit);

  let rr = 0;
  return picked.map(({ w }) => {
    let day: number | null = null;
    const sched = w.magazine?.schedule ?? "";
    for (const [re, d] of WD_SCHEDULE) {
      if (re.test(sched)) { day = d; break; }
    }
    if (day == null) day = rr++ % 7; // distribuição estável (estimativa rotulada)
    const next = new Date(now);
    const delta = (day - next.getDay() + 7) % 7;
    next.setDate(next.getDate() + delta);
    return {
      work: w,
      nextChapter: w.chapters != null && w.chapters > 0 ? w.chapters + 1 : null,
      dateISO: next.toISOString().slice(0, 10),
      weekday: WD_PT[next.getDay()],
      stale: now - w.lastUpdate! * 1000 > 21 * 86400000,
    };
  });
}
