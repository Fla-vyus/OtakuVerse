// Motor de scoring — usado no servidor (/api/foryou, /api/works/[id])
// Sem dependência de client — tipos puros.
import type { WorkData } from "@/lib/types";

export interface TagRefLike {
  name: string;
  rank: number;
}

/** Overlap de tags ponderado por rank (0–1 escala) */
export function tagScore(a: { tags: TagRefLike[] }, b: { tags: TagRefLike[] }): number {
  const bTags = new Map(b.tags.map((t) => [t.name, t.rank]));
  let s = 0;
  for (const t of a.tags) {
    const r2 = bTags.get(t.name);
    if (r2) s += (t.rank * r2) / 10000;
  }
  return s;
}

export function genreScore(a: { genres: string[] }, b: { genres: string[] }): number {
  const bg = new Set(b.genres);
  return a.genres.filter((g) => bg.has(g)).length * 0.9;
}

/** Similaridade geral entre duas obras (usado em "parecidas") */
export function similarityScore(target: WorkData, w: WorkData): number {
  let s = tagScore(target, w) * 1.15 + genreScore(target, w);
  if (w.type === target.type) s += 0.4;
  if (w.country === target.country) s += 0.25;
  s += ((w.avgScore ?? 60) - 60) / 100;
  return s;
}

// ---------- Perfil de gosto (espelha components/portal/personal) ----------
export interface TasteProfileLike {
  types: string[];
  genres: string[];
  tags: string[];
  spice: number;
  vibe: "leve" | "equilibrado" | "pesado";
}

export interface ListEntryLike {
  status: string;
  rating?: number;
  addedAt: number;
}

export interface ForYouResult {
  work: WorkData;
  score: number;
  reasons: string[];
}

/** Pontua uma obra contra o perfil de gosto + favoritos do usuário. */
export function scoreForYou(
  work: WorkData,
  taste: TasteProfileLike,
  favWorks: WorkData[],
  lists: Record<string, ListEntryLike>,
  opts?: { excludeIds?: Set<string>; surprise?: boolean }
): ForYouResult {
  const reasons: string[] = [];
  let score = 0;

  const excluded = opts?.excludeIds;
  const baseQuality = ((work.avgScore ?? 60) - 60) / 40 + Math.min(work.popularity ?? 0, 400000) / 400000 * 1.2;

  // 1. Tipo preferido
  if (taste.types.includes(work.type)) {
    score += 1.2;
    reasons.push("está no formato que você curte");
  }

  // 2. Gêneros do perfil (agora em PT-BR via ptTags)
  const workPtTags = work.ptTags ?? [];
  const genreHits = workPtTags.filter((g) => taste.genres.includes(g));
  if (genreHits.length > 0) {
    score += genreHits.length * 1.1;
    reasons.push(`gênero(s) ${genreHits.slice(0, 2).join(" + ").toLowerCase()} do seu perfil`);
  }

  // 3. Tags do perfil (PT-BR)
  let tagHits = 0;
  for (const t of workPtTags) {
    if (taste.tags.includes(t)) {
      tagHits++;
      score += 1.0;
    }
  }
  if (tagHits > 0) {
    const matched = taste.tags.filter((x) => workPtTags.includes(x)).slice(0, 2);
    reasons.push(`marca ${tagHits > 1 ? "fortes" : "forte"} de ${matched.join(" & ").toLowerCase()}`);
  }

  // 4. Picância (ptTags adulto + tags)
  const isAdultish = workPtTags.includes("+18") || workPtTags.includes("Hentai") || work.isAdult;
  const spicyRank = work.tags.find((t) => t.name === "Nudity")?.rank ?? 0;
  const hasSexual = isAdultish || workPtTags.includes("Ecchi");
  if (taste.spice === 0) {
    if (spicyRank >= 40 || hasSexual) score -= 1.6;
  } else if (taste.spice >= 2 && (spicyRank >= 40 || hasSexual)) {
    score += 1.3 + taste.spice * 0.3;
    reasons.push(isAdultish ? "conteúdo adulto no nível que você gosta" : "nível sensorial no ponto que você gosta");
  } else if (taste.spice === 1 && spicyRank > 0 && spicyRank < 60) {
    score += 0.4;
  }

  // 5. Vibração (leve/pesado) — ptTags PT-BR
  const heavyTags = workPtTags.filter((t) => ["Gore", "Tragédia", "Psicológico", "Sobrevivência", "Guerra", "Horror Corporal"].includes(t)).length;
  const lightTags = workPtTags.filter((t) => ["Iyashikei", "Cotidiano", "Fofura Cotidiana", "Slapstick", "Paródia"].includes(t)).length;
  if (taste.vibe === "leve" && lightTags > 0) { score += 0.9; reasons.push("tom leve/acolhedor"); }
  if (taste.vibe === "pesado" && heavyTags > 0) { score += 0.9; reasons.push("tema pesado do seu agrado"); }
  if (taste.vibe === "equilibrado") score += 0.2;

  // 6. Similaridade com favoritos
  let bestFav: { w: WorkData; s: number } | null = null;
  for (const fw of favWorks) {
    if (fw.id === work.id) continue;
    let s = tagScore(work, fw);
    s += work.genres.filter((g) => fw.genres.includes(g)).length * 0.5;
    if (!bestFav || s > bestFav.s) bestFav = { w: fw, s };
  }
  if (bestFav && bestFav.s > 0.8) {
    score += Math.min(bestFav.s, 3.2);
    reasons.push(`parecida com ${bestFav.w.title}`);
  }

  // 7. Qualidade como base
  score += baseQuality * 0.55;

  // 8. Modo surpresa
  if (opts?.surprise) {
    score = score * 0.55 + ((work.popularity ?? 0) < 80000 ? 1.8 : 0.2) + Math.random() * 1.6;
    if ((work.popularity ?? 0) < 80000) reasons.push("joia fora do radar mainstream");
  }

  // Penalidades
  if (excluded?.has(work.id)) score -= 100;
  const st = lists[work.id]?.status;
  if (st === "lido" || st === "dropei") score -= 100;
  if (st === "lendo" || st === "quero" || st === "pausei") score -= 1.2;

  return { work, score, reasons: reasons.slice(0, 3) };
}
