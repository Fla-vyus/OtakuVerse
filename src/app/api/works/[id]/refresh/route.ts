import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { anilistFetch, toWorkRow } from "@/lib/anilist";
import { mdFetch, MD_UA } from "@/lib/sources/mangadex";
import { muEnrich, muCover } from "@/lib/sources/mangaupdates";

export const dynamic = "force-dynamic";

const REFRESH_FIELDS = `
  id idMal type title { romaji english native } synonyms description
  coverImage { extraLarge large color } bannerImage format status
  chapters volumes episodes duration startDate { year month day } endDate { year month day }
  countryOfOrigin isAdult genres tags { name rank } averageScore popularity favourites
  source siteUrl updatedAt
  staff(perPage: 4) { edges { role node { name { full } } } }
  externalLinks { site url language type color icon }
  nextAiringEpisode { airingAt timeUntilAiring episode }
`;

function norm(s: string) {
  return s.toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

/**
 * Re-resolve a capa de UMA obra a partir de outra fonte REAL quando a imagem atual falhou:
 *  - obra AniList → procura no MangaDex (capa real + idiomas reais)
 *  - obra MangaDex → procura na AniList (capa real)
 *  - Kitsu → procura na AniList/MangaDex
 *  - qualquer mangá → procura no MangaUpdates (3ª fonte de capa real, fonte #6)
 * Nunca inventa imagem: só troca por outra URL oficial. Throttle simples por memória.
 */
const lastRefresh = new Map<string, number>();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const now = Date.now();
    const last = lastRefresh.get(id) ?? 0;
    if (now - last < 10 * 60 * 1000) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    lastRefresh.set(id, now);

    const work = await db.work.findUnique({ where: { id } });
    if (!work) return NextResponse.json({ ok: false, error: "Obra não encontrada" }, { status: 404 });

    const isAnilist = /^\d+$/.test(id);
    const isMd = id.startsWith("md-");
    const isKt = id.startsWith("kt-");
    if (/^(tv-|g)/.test(id)) return NextResponse.json({ ok: true, skipped: true }); // TVMaze/outros não têm segunda fonte

    const title = (work.titleEn || work.title).slice(0, 80);

    // ---- 1) tenta a outra fonte por título ----
    let altCover: string | null = null;
    let altLangs: string | null = null;
    let altId: string | null = null;

    if (isAnilist || isKt) {
      const params = new URLSearchParams();
      params.set("limit", "5");
      params.set("title", title);
      params.set("includes[]", "cover_art");
      params.append("contentRating[]", "safe");
      params.append("contentRating[]", "suggestive");
      params.append("contentRating[]", "erotica");
      const data = await mdFetch("/manga", params).catch(() => null);
      const hits: any[] = data?.data ?? [];
      const wanted = norm(title);
      const hit = hits.find((m) => {
        const titles = [m.attributes?.title?.["en"], ...((m.attributes?.altTitles ?? []).map((t: any) => t["en"]).filter(Boolean) ?? [])].filter(Boolean).map(norm);
        return titles.some((t: string) => t === wanted);
      }) ?? hits[0];
      if (hit) {
        const rel = hit.relationships?.find?.((r: any) => r.type === "cover_art");
        if (rel?.attributes?.fileName) altCover = `https://uploads.mangadex.org/covers/${hit.id}/${rel.attributes.fileName}`;
        altLangs = JSON.stringify(hit.attributes?.availableTranslatedLanguages ?? []);
        altId = `md-${hit.id}`;
      }
    }

    if (isMd || (isKt && !altCover)) {
      const data = await anilistFetch(
        `query ($q: String) { Page(perPage: 5) { media(search: $q, type: MANGA) { ${REFRESH_FIELDS} } } }`,
        { q: title }
      ).catch(() => null);
      const hits: any[] = data?.Page?.media ?? [];
      const wanted = norm(title);
      const hit = hits.find((m) => {
        const titles = [m.title?.romaji, m.title?.english].filter(Boolean).map(norm);
        return titles.some((t: string) => t === wanted);
      }) ?? hits[0];
      if (hit?.coverImage?.extraLarge) altCover = hit.coverImage.extraLarge;
      if (hit) altId = String(hit.id);
    }

    // ---- 1b) MangaUpdates (fonte #6) — capa editorial real como último recurso ----
    if (!altCover && (isAnilist || isMd || isKt)) {
      const mu = await muEnrich(work.title, work.titleEn).catch(() => null);
      const muCoverUrl = muCover(mu as any);
      if (muCoverUrl) altCover = muCoverUrl;
    }

    if (!altCover) return NextResponse.json({ ok: true, found: false });

    // ---- 2) aplica: capa quebrada → alterna; senão adiciona como alternativa ----
    const currentAlts: string[] = work.coverAlts ? JSON.parse(work.coverAlts) : [];
    const data: any = {};
    if (work.cover && work.cover !== altCover) {
      if (!currentAlts.includes(work.cover)) currentAlts.unshift(work.cover);
    }
    if (!currentAlts.includes(altCover)) currentAlts.unshift(altCover);
    data.cover = altCover;
    data.coverAlts = JSON.stringify([...new Set(currentAlts)].filter((u) => u !== altCover).slice(0, 6));
    if (altLangs && !work.langs) data.langs = altLangs;

    await db.work.update({ where: { id }, data }).catch(() => {});
    return NextResponse.json({ ok: true, found: true, cover: altCover, twin: altId });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
