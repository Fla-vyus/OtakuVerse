import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anilistFetch, toWorkRow } from "@/lib/anilist";
import { mdFetch, mdToWorkRow, sleep } from "@/lib/sources/mangadex";

export const dynamic = "force-dynamic";

const MIN_INTERVAL = 20 * 60; // 20 min entre sincronizações

const SYNC_FIELDS = `
  id
  idMal
  type
  title { romaji english native }
  synonyms
  description
  coverImage { extraLarge large color }
  bannerImage
  format
  status
  chapters
  volumes
  episodes
  duration
  startDate { year month day }
  endDate { year month day }
  countryOfOrigin
  isAdult
  genres
  tags { name rank }
  averageScore
  popularity
  favourites
  source
  siteUrl
  updatedAt
  staff(perPage: 4) { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

/**
 * Auto-atualização do catálogo REAL (agora via BROKER):
 * 1) AniList — novas obras em alta + pagina profunda (popularity) para crescer o acervo
 * 2) MangaDex — títulos recém-atualizados (capítulos novos de verdade)
 * 3) Notícias — o feed MAL se renova sozinho (cache de 90 min em getNews)
 * O BROKER (src/lib/broker.ts) espaça as requisições por fonte, respeita
 * Retry-After e abre circuit breaker se uma fonte cair — sem bloqueios.
 * A ordem das fases alterna a cada execução para distribuir a carga entre fontes.
 */
export async function POST() {
  try {
    const meta = await db.syncMeta.findUnique({ where: { id: "anilist" } });
    const now = Math.floor(Date.now() / 1000);
    const runNo = (meta?.added ?? 0) + (meta?.updated ?? 0);
    if (meta && now - meta.lastSync < MIN_INTERVAL) {
      return NextResponse.json({ ok: true, skipped: true, lastSync: meta.lastSync, added: meta.added, updated: meta.updated });
    }

    let added = 0;
    let updated = 0;
    const existing = new Set(
      (await db.work.findMany({ select: { id: true } })).map((r) => r.id)
    );

    // ---------- 1) AniList: trending (24) + páginas profundas de popularidade (3×50) ----------
    const totalKnown = existing.size;
    const baseDepth = Math.floor(totalKnown / 100) % 40;
    // rotação: a cada execução alterna a profundidade inicial para varrer o catálogo da fonte
    const depthPages = runNo % 2 === 0 ? [baseDepth, 0, 1] : [0, 1, baseDepth];
    const queries: { q: string; vars: Record<string, unknown> }[] = [
      { q: `query ($perPage: Int) { Page(perPage: $perPage) { media(sort: TRENDING_DESC, type: MANGA) { ${SYNC_FIELDS} } } }`, vars: { perPage: 24 } },
      { q: `query ($perPage: Int) { Page(perPage: $perPage) { media(sort: TRENDING_DESC, type: ANIME) { ${SYNC_FIELDS} } } }`, vars: { perPage: 12 } },
      ...depthPages.map((p) => ({
        q: `query ($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(sort: POPULARITY_DESC, type: MANGA) { ${SYNC_FIELDS} } } }`,
        vars: { page: p + 1, perPage: 50 },
      })),
      { q: `query ($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { media(sort: POPULARITY_DESC, type: ANIME) { ${SYNC_FIELDS} } } }`, vars: { page: depthPages[0] + 1, perPage: 50 } },
    ];

    for (const { q, vars } of queries) {
      try {
        const data = await anilistFetch(q, vars);
        for (const m of data?.Page?.media ?? []) {
          const row = toWorkRow(m);
          // upsert à prova de corrida (syncs simultâneos não geram "Unique constraint failed")
          const existed = existing.has(row.id);
          const res = await db.work.upsert({
            where: { id: row.id },
            update: {
              status: row.status, chapters: row.chapters, volumes: row.volumes, episodes: row.episodes,
              avgScore: row.avgScore, popularity: row.popularity, favourites: row.favourites,
              lastUpdate: row.lastUpdate, nextEpisodeAt: row.nextEpisodeAt, nextEpisodeNum: row.nextEpisodeNum,
              cover: row.cover || undefined, banner: row.banner, genres: row.genres, tags: row.tags,
              extLinks: row.extLinks, titleEn: row.titleEn, titleNative: row.titleNative,
            },
            create: row,
          }).catch(() => null);
          if (res) {
            if (existed) updated++;
            else added++;
            existing.add(row.id);
          }
        }
      } catch {}
      await sleep(300); // o broker já espaça em ~2,2 s; sleep curto só para ceder o event loop
    }

    // ---------- 2) MangaDex: recém-atualizados (2 páginas) ----------
    for (const page of [0, 1]) {
      try {
        const params = new URLSearchParams();
        params.set("limit", "50");
        params.set("offset", String(page * 50));
        params.set("order[latestUploadedChapter]", "desc");
        params.append("includes[]", "cover_art");
        params.append("includes[]", "author");
        params.append("includes[]", "artist");
        params.append("contentRating[]", "safe");
        params.append("contentRating[]", "suggestive");
        params.append("contentRating[]", "erotica");
        const data = await mdFetch("/manga", params);
        for (const m of data?.data ?? []) {
          const row = mdToWorkRow(m);
          const existed = existing.has(row.id);
          const res = await db.work.upsert({
            where: { id: row.id },
            update: { chapters: row.chapters, status: row.status, lastUpdate: row.lastUpdate, langs: row.langs, cover: row.cover || undefined, popularity: row.popularity ?? undefined },
            create: row,
          }).catch(() => null);
          if (res) {
            if (existed) updated++;
            else added++;
            existing.add(row.id);
          }
        }
      } catch {}
      await sleep(250);
    }

    await db.syncMeta.upsert({
      where: { id: "anilist" },
      create: { id: "anilist", lastSync: now, added, updated },
      update: { lastSync: now, added, updated },
    });

    return NextResponse.json({ ok: true, skipped: false, lastSync: now, added, updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 502 });
  }
}
