// v4.0 — ETAPA 1 (estabilidade): camada SQL DIRETA ao Turso — sem pool em memória.
//
// Por que: o pool de 6.5k obras em RAM (rss ~230MB só dele) era a principal causa
// de OOM no container publicado (pouca RAM, sem reinício automático). Busca,
// filtros e listas agora consultam o Turso com SQL paginado (LIMIT/OFFSET),
// índices nas colunas de ordenação e json_each para gênero/tag. Cache pequeno
// permitido por design: contagens (TTL 2 min, ≤200 entradas) e facets (TTL 30 min).
//
// Busca por texto: FTS5 (tabela work_fts, reconstruída por /api/admin/refresh ou
// scripts/db-indexes.ts) com fallback LIKE para zona adulta/FTS ausente.
//
// Gating +18 idêntico ao pool antigo:
//   zona pública: classification != 'adult' AND type != 'drama'
//   zona adulta:  classification = 'adult'
// Dramas NUNCA aparecem (removidos do catálogo a pedido do usuário).
import { db } from "@/lib/db";
import { isRemoteDb } from "@/lib/runtime-env";
import { toCardWork } from "@/lib/works";
import { parseWork, type WorkData } from "@/lib/types";
import type { AdultMode, RankMetric } from "@/lib/works";

export const PER_PAGE_DEFAULT = 24;
export const PER_PAGE_MAX = 60;

// Projeção de CARD em SQL — os campos pesados (synopsis/synopsisPT/siteUrl/extLinks/
// network/source/langs/coverAlts/duration) ficam FORA: cards nunca os usam e o
// detalhe continua vindo inteiro por id. banner entra (hero do hype/badges).
const CARD_COLS = `"id","malId","type","format","title","titleEn","titleNative","synonyms","cover","coverAlt","coverColor","banner","status","chapters","volumes","episodes","startDate","endDate","country","isAdult","classification","adultTags","genres","tags","avgScore","popularity","favourites","authors","magazine","lastUpdate","nextEpisodeAt","nextEpisodeNum","ptTags","trending","spicy","follows"`;

export const PUBLIC_GATE = `"classification" != 'adult' AND "type" != 'drama'`;

// ---------- Guards de produção ----------
/** Produção SEM Turso nunca pode responder "vazio" — falha ALTA e legível. */
export function assertRemoteOrDev(): void {
  if (!isRemoteDb && process.env.NODE_ENV === "production") {
    throw new Error("PRODUCAO-SEM-TURSO: banco de produção não configurado (veja /api/health)");
  }
}

// ---------- Cache pequeno de contagens (o único estado permitido aqui) ----------
const gCnt = globalThis as unknown as { __ovSqlCounts?: Map<string, { n: number; at: number }> };
const COUNT_TTL = 120_000; // 2 min
function countsMap(): Map<string, { n: number; at: number }> {
  if (!gCnt.__ovSqlCounts) gCnt.__ovSqlCounts = new Map();
  const m = gCnt.__ovSqlCounts;
  if (m.size > 200) {
    // poda: expira vencidos; se ainda grande, limpa tudo (barato e raro)
    const now = Date.now();
    for (const [k, v] of m) if (now - v.at > COUNT_TTL) m.delete(k);
    if (m.size > 200) m.clear();
  }
  return m;
}
async function cachedCount(key: string, fn: () => Promise<number>): Promise<number> {
  const m = countsMap();
  const hit = m.get(key);
  if (hit && Date.now() - hit.at < COUNT_TTL) return hit.n;
  const n = await fn();
  m.set(key, { n, at: Date.now() });
  return n;
}

// ---------- FTS5 ----------
const gFts = globalThis as unknown as { __ovFtsReady?: boolean };
async function ftsReady(): Promise<boolean> {
  if (gFts.__ovFtsReady !== undefined) return gFts.__ovFtsReady;
  try {
    const rows = await db.$queryRawUnsafe<{ name: string }[]>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='work_fts'`
    );
    gFts.__ovFtsReady = Array.isArray(rows) && rows.length > 0;
  } catch {
    gFts.__ovFtsReady = false;
  }
  return gFts.__ovFtsReady;
}

/** Consulta FTS5 com prefixo por token (máx. 6 tokens). ids dedup, cap 600. */
const FTS_ID_CAP = 600;
async function ftsMatch(q: string): Promise<string | null> {
  const tokens = q
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9à-ÿ']/gi, ""))
    .filter((t) => t.length >= 2)
    .slice(0, 6);
  if (!tokens.length) return null;
  return tokens.map((t) => `${t}*`).join(" ");
}
async function ftsIds(q: string): Promise<string[] | null> {
  if (!(await ftsReady())) return null;
  const match = await ftsMatch(q);
  if (!match) return null;
  try {
    const rows = await db.$queryRawUnsafe<{ workId: string }[]>(
      `SELECT workId FROM work_fts WHERE work_fts MATCH ? LIMIT ${FTS_ID_CAP}`,
      match
    );
    const ids = [...new Set(rows.map((r) => String(r.workId)))];
    return ids.length ? ids : null; // 0 hits → LIKE cobra títulos recém-chegados
  } catch {
    return null; // sintaxe inválida/FTS indisponível → LIKE
  }
}
/** Contagem exata do FTS (índice server-side — barato). null se FTS ausente. */
async function ftsCount(q: string): Promise<number | null> {
  if (!(await ftsReady())) return null;
  const match = await ftsMatch(q);
  if (!match) return null;
  try {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*) as n FROM work_fts WHERE work_fts MATCH ?`,
      match
    );
    return Number(rows[0]?.n ?? 0);
  } catch {
    return null;
  }
}

// ---------- Builder de filtros ----------
export interface SqlListFilters {
  type?: string;
  genre?: string;
  tag?: string;
  status?: string;
  lang?: string;
  classification?: string; // all | safe | suggestive (zona pública)
  mag?: string;
  q?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  adultZone?: boolean;
}

const SORTS: Record<string, string> = {
  popular: `"popularity" DESC`,
  score: `"avgScore" DESC`,
  favorites: `"favourites" DESC`,
  new: `"startDate" DESC`,
  chapters: `"chapters" DESC`,
  title: `"title" ASC`,
};

function langClause(lang: string): { sql: string; arg?: string } | null {
  switch (lang.toUpperCase()) {
    case "JA": return { sql: `"country" = ?`, arg: "JP" };
    case "KO": return { sql: `"country" = ?`, arg: "KR" };
    case "ZH": return { sql: `"country" IN ('CN','TW')` };
    case "EN": return { sql: `"popularity" >= 100000` };
    case "PT-BR": return { sql: `("popularity" >= 200000 OR "type" = 'anime')` };
    default: return null;
  }
}

function buildWhere(f: SqlListFilters, opts?: { skipQ?: boolean }): { sql: string; args: unknown[] } {
  const parts: string[] = [];
  const args: unknown[] = [];
  if (f.adultZone) {
    parts.push(`"classification" = 'adult'`);
  } else {
    parts.push(PUBLIC_GATE);
    if (f.classification && f.classification !== "all") {
      parts.push(`"classification" = ?`);
      args.push(f.classification);
    }
  }
  if (f.type && f.type !== "all") { parts.push(`"type" = ?`); args.push(f.type); }
  if (f.status && f.status !== "all") { parts.push(`"status" = ?`); args.push(f.status); }
  if (f.genre && f.genre !== "all") {
    parts.push(`EXISTS (SELECT 1 FROM json_each("genres") je WHERE je.value = ?)`);
    args.push(f.genre);
  }
  if (f.tag && f.tag !== "all") {
    parts.push(`EXISTS (SELECT 1 FROM json_each("tags") je WHERE json_extract(je.value,'$.name') = ? AND json_extract(je.value,'$.rank') >= 40)`);
    args.push(f.tag);
  }
  if (f.mag && f.mag !== "all") {
    parts.push(`json_extract("magazine",'$.name') = ?`);
    args.push(f.mag);
  }
  if (f.lang && f.lang !== "all") {
    const l = langClause(f.lang);
    if (l) { parts.push(l.sql); if (l.arg) args.push(l.arg); }
  }
  if (f.q && !opts?.skipQ) {
    parts.push(`("title" LIKE ? OR "titleEn" LIKE ? OR "titleNative" LIKE ? OR "synonyms" LIKE ? OR "authors" LIKE ?)`);
    const like = `%${f.q.toLowerCase().trim()}%`;
    args.push(like, like, like, like, like);
  }
  return { sql: parts.join(" AND "), args };
}

// ---------- Consulta principal (lista/busca/filtro) ----------
export interface SqlPage {
  items: WorkData[]; // já em projeção de card
  total: number;
  page: number;
  perPage: number;
}

export async function queryWorksSql(f: SqlListFilters): Promise<SqlPage> {
  assertRemoteOrDev();
  const page = Math.max(1, f.page ?? 1);
  const perPage = Math.min(PER_PAGE_MAX, Math.max(6, f.perPage ?? PER_PAGE_DEFAULT));
  const order = SORTS[f.sort ?? "popular"] ?? SORTS.popular;

  // busca: FTS5 primeiro (índice), LIKE como fallback/universo adulto.
  // total na busca FTS = contagem do PRÓPRIO índice (LIKE mentiria nas páginas fundas).
  const { sql: where, args } = buildWhere(f);
  let qWhere = where;
  let qArgs = [...args];
  let countOverride: number | null = null;
  if (f.q && f.q.trim()) {
    const ids = f.adultZone ? null : await ftsIds(f.q);
    if (ids) {
      const { sql: whereNoQ, args: argsNoQ } = buildWhere(f, { skipQ: true });
      const placeholders = ids.map(() => "?").join(",");
      qWhere = `${whereNoQ} AND "id" IN (${placeholders})`;
      qArgs = [...argsNoQ, ...ids];
      const fc = await ftsCount(f.q);
      if (fc !== null && fc > 0) countOverride = fc;
    }
  }

  const countKey = `c:${f.adultZone ? "a" : "p"}:${f.q ?? ""}|${f.type ?? ""}|${f.genre ?? ""}|${f.tag ?? ""}|${f.status ?? ""}|${f.lang ?? ""}|${f.mag ?? ""}|${f.classification ?? ""}`;
  const total = countOverride ?? (await cachedCount(countKey, async () => {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*) as n FROM "Work" WHERE ${qWhere}`,
      ...qArgs
    );
    return Number(rows[0]?.n ?? 0);
  }));

  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${CARD_COLS} FROM "Work" WHERE ${qWhere} ORDER BY ${order} LIMIT ? OFFSET ?`,
    ...qArgs, perPage, (page - 1) * perPage
  );
  const items = rows.map((r) => toCardWork(parseWork(r)));
  return { items, total, page, perPage };
}

/** Tamanho do catálogo da zona (com gating, sem filtros) — usado no rodapé do Explorar. */
export async function catalogSizeSql(adultZone: boolean): Promise<number> {
  return cachedCount(`size:${adultZone ? "a" : "p"}`, async () => {
    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*) as n FROM "Work" WHERE ${adultZone ? `"classification" = 'adult'` : PUBLIC_GATE}`
    );
    return Number(rows[0]?.n ?? 0);
  });
}

// ---------- Facets (gêneros/tags/revistas) ----------
export interface Facets {
  genres: { name: string; count: number }[];
  tags: { name: string; count: number }[];
  magazines: { name: string; count: number }[];
  at: number;
}
const gFac = globalThis as unknown as { __ovSqlFacets?: Record<string, { v: Facets; at: number }> };
const FACETS_TTL = 30 * 60_000;

export async function getFacetsSql(adultZone = false): Promise<Facets> {
  assertRemoteOrDev();
  const key = adultZone ? "adult" : "public";
  if (!gFac.__ovSqlFacets) gFac.__ovSqlFacets = {};
  const hit = gFac.__ovSqlFacets[key];
  if (hit && Date.now() - hit.at < FACETS_TTL) return hit.v;

  const gate = adultZone ? `"classification" = 'adult'` : PUBLIC_GATE;
  const [genres, tags, magazines] = await Promise.all([
    db.$queryRawUnsafe<{ name: string; count: number }[]>(
      `SELECT je.value AS name, COUNT(*) AS count FROM "Work" w, json_each(w."genres") je
       WHERE ${gate.replace(/"(classification|type)"/g, 'w."$1"')} GROUP BY je.value ORDER BY count DESC`
    ),
    db.$queryRawUnsafe<{ name: string; count: number }[]>(
      `SELECT json_extract(je.value,'$.name') AS name, COUNT(*) AS count
       FROM "Work" w, json_each(w."tags") je
       WHERE ${gate.replace(/"(classification|type)"/g, 'w."$1"')} AND json_extract(je.value,'$.rank') >= 40
       GROUP BY name ORDER BY count DESC LIMIT 80`
    ),
    db.$queryRawUnsafe<{ name: string; count: number }[]>(
      `SELECT json_extract(w."magazine",'$.name') AS name, COUNT(*) AS count
       FROM "Work" w
       WHERE ${gate.replace(/"(classification|type)"/g, 'w."$1"')} AND w."magazine" IS NOT NULL
         AND json_extract(w."magazine",'$.name') IS NOT NULL AND json_extract(w."magazine",'$.name') != ''
       GROUP BY name ORDER BY count DESC LIMIT 50`
    ),
  ]);
  const facets: Facets = {
    genres: genres.map((r) => ({ name: String(r.name), count: Number(r.count) })),
    tags: tags.map((r) => ({ name: String(r.name), count: Number(r.count) })),
    magazines: magazines.map((r) => ({ name: String(r.name), count: Number(r.count) })),
    at: Date.now(),
  };
  // NUNCA cacheia facets vazias (banco a meio restore deixaria dropdown sem opções)
  if (facets.genres.length > 0) gFac.__ovSqlFacets[key] = { v: facets, at: Date.now() };
  return facets;
}

// ---------- Rankings ----------
export async function getRankingSql(type: string, metric: RankMetric, adult: AdultMode, take = 24): Promise<WorkData[]> {
  assertRemoteOrDev();
  const col = metric === "score" ? `"avgScore"` : metric === "favorites" ? `"favourites"` : metric === "chapters" ? `"chapters"` : `"popularity"`;
  let gate: string;
  if (adult === "only") gate = `"classification" = 'adult'`;
  else if (adult === "show") gate = `"type" != 'drama'`; // público + adulto
  else gate = PUBLIC_GATE;
  let where = gate;
  const args: unknown[] = [];
  if (type && type !== "all") { where += ` AND "type" = ?`; args.push(type); }
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${CARD_COLS} FROM "Work" WHERE ${where} ORDER BY ${col} DESC LIMIT ?`,
    ...args, Math.min(96, Math.max(1, take))
  );
  return rows.map((r) => toCardWork(parseWork(r)));
}

// ---------- Busca SQL crua (para admin/refresh e candidatos) ----------
/** SELECT de cards com where cru — usado por home_cache e candidatos de IA/related. */
export async function selectCards(where: string, args: unknown[], orderBy: string, limit: number, offset = 0): Promise<WorkData[]> {
  assertRemoteOrDev();
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT ${CARD_COLS} FROM "Work" WHERE ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    ...args, limit, offset
  );
  return rows.map((r) => parseWork(r));
}
