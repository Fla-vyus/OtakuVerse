import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildPtTags } from "@/lib/tagmap";
import { parseWork } from "@/lib/types";

export const dynamic = "force-dynamic";

const API = "https://graphql.anilist.co";
const THROTTLE_MS = 12 * 60 * 1000; // sync no máx. a cada 12 min

const FIELDS = `
  id
  type
  format
  status
  chapters
  episodes
  averageScore
  popularity
  favourites
  isAdult
  genres
  tags { name rank }
  source
  updatedAt
  nextAiringEpisode { airingAt episode }
`;

async function gql(query: string, variables: Record<string, unknown>): Promise<any> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 8000));
        throw new Error("rate limit");
      }
      const json: any = await res.json();
      if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 200));
      return json.data;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

/**
 * Pulso de sincronização: busca o que está EM ALTA na AniList agora e
 * atualiza o acervo local (scores, popularidade, trending, episódios).
 * O cliente chama este endpoint a cada ~10 min enquanto o site está aberto —
 * é assim que o portal se mantém atualizado sozinho.
 */
export async function POST(req: NextRequest) {
  // TRANCADO: job pesado de sincronização — exige a chave do cron (igual /api/cron/refresh)
  const key = req.nextUrl.searchParams.get("key");
  if (!process.env.CRON_KEY || key !== process.env.CRON_KEY) {
    return NextResponse.json({ ok: false, error: "Chave inválida" }, { status: 403 });
  }
  try {
    const state = await db.syncState.findUnique({ where: { id: "main" } });
    const now = Date.now();
    if (state && now - state.lastSync * 1000 < THROTTLE_MS) {
      return NextResponse.json({ ok: true, skipped: true, lastSync: state.lastSync, worksTouched: state.worksTouched });
    }

    const TRENDING_Q = `query ($page: Int, $type: MediaType) {
      Page(perPage: 50, page: $page) {
        media(type: $type, sort: TRENDING_DESC, isAdult: false) { ${FIELDS} }
      }
    }`;
    const AIRING_Q = `query ($page: Int) {
      Page(perPage: 50, page: $page) {
        media(type: ANIME, status: RELEASING, sort: TIME_DESC) { ${FIELDS} nextAiringEpisode { airingAt episode } }
      }
    }`;

    const nowUnix = Math.floor(Date.now() / 1000);
    let touched = 0;

    // 1) Trending geral (mangás+animes misturados) — captura o "quente agora"
    for (const { q, vars } of [
      { q: TRENDING_Q, vars: { page: 1 } },
      { q: TRENDING_Q, vars: { page: 2, type: "ANIME" as const } },
      { q: TRENDING_Q, vars: { page: 2, type: "MANGA" as const } },
    ]) {
      try {
        const data = await gql(q, vars);
        const media: any[] = data?.Page?.media ?? [];
        for (let i = 0; i < media.length; i++) {
          const m = media[i];
          const pt = m.genres?.includes("Hentai") ? null : undefined; // mantém ptTags existente
          await db.work.updateMany({
            where: { id: String(m.id) },
            data: {
              avgScore: m.averageScore ?? null,
              popularity: m.popularity ?? null,
              favourites: m.favourites ?? null,
              trending: i + 1,
              trendingAt: nowUnix,
              lastUpdate: m.updatedAt ?? nowUnix,
              status: m.status ?? null,
              ...(pt === null ? {} : {}),
            },
          });
          touched++;
        }
      } catch { /* segue o baile */ }
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 2) Obras novas que entraram no acervo (trending inclui novidades) — cria se não existir
    try {
      const data = await gql(TRENDING_Q, { page: 1 });
      const media: any[] = data?.Page?.media ?? [];
      for (let i = 0; i < media.length; i++) {
        const m = media[i];
        const exists = await db.work.findUnique({ where: { id: String(m.id) }, select: { id: true } });
        if (exists) continue;
        // cria registro mínimo (completa depois na próxima sincronização completa)
        await db.work.create({
          data: {
            id: String(m.id),
            type: m.type === "ANIME" ? "anime" : m.format === "NOVEL" ? "lightnovel" : "manga",
            format: m.format ?? null,
            title: `#${m.id}`,
            cover: "",
            status: m.status ?? null,
            isAdult: !!m.isAdult,
            genres: JSON.stringify(m.genres ?? []),
            tags: JSON.stringify((m.tags ?? []).map((t: any) => ({ name: t.name, rank: t.rank }))),
            ptTags: JSON.stringify(buildPtTags({ genres: m.genres ?? [], tags: m.tags ?? [], isAdult: !!m.isAdult, source: m.source ?? null })),
            avgScore: m.averageScore ?? null,
            popularity: m.popularity ?? null,
            favourites: m.favourites ?? null,
            trending: i + 1,
            trendingAt: nowUnix,
            lastUpdate: m.updatedAt ?? nowUnix,
          },
        }).catch(() => {});
        touched++;
      }
    } catch { /* ignora */ }

    // 3) Agenda de animes em exibição (datas reais dos próximos episódios)
    for (const page of [1, 2, 3]) {
      try {
        const data = await gql(AIRING_Q, { page });
        const media: any[] = data?.Page?.media ?? [];
        for (const m of media) {
          const next = m.nextAiringEpisode;
          if (!next) continue;
          const iso = new Date(next.airingAt * 1000).toISOString();
          if (next.airingAt * 1000 < Date.now() - 6 * 3600 * 1000) continue; // já passou
          await db.work.updateMany({
            where: { id: String(m.id) },
            data: { nextEpisodeAt: iso, nextEpisodeNum: next.episode ?? null, lastUpdate: m.updatedAt ?? nowUnix },
          });
          touched++;
        }
      } catch { /* segue */ }
      await new Promise((r) => setTimeout(r, 1200));
    }

    // 4) Limpa datas de episódios que já passaram (mantém o calendário honesto)
    await db.$executeRawUnsafe(
      `UPDATE Work SET nextEpisodeAt = NULL, nextEpisodeNum = NULL WHERE nextEpisodeAt IS NOT NULL AND nextEpisodeAt < ?`,
      new Date(Date.now() - 6 * 3600 * 1000).toISOString()
    );

    const state2 = await db.syncState.upsert({
      where: { id: "main" },
      create: { id: "main", lastSync: nowUnix, worksTouched: touched, note: "pulse" },
      update: { lastSync: nowUnix, worksTouched: touched, note: "pulse" },
    });

    return NextResponse.json({ ok: true, lastSync: state2.lastSync, worksTouched: touched });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  const state = await db.syncState.findUnique({ where: { id: "main" } });
  return NextResponse.json({ ok: true, lastSync: state?.lastSync ?? null, worksTouched: state?.worksTouched ?? 0 });
}
