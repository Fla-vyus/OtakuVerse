// Calendário: animes em exibição agrupados por dia da semana (dados reais de
// nextEpisodeAt) + capítulos estimados das séries ativas + grade do mês.
// v4.0: três queries SQL delimitadas — sem pool em memória.
import { NextRequest } from "next/server";
import { estimateChapterReleases, toCardWork } from "@/lib/works";
import { selectCards, PUBLIC_GATE } from "@/lib/works-sql";
import { db } from "@/lib/db";
import type { WorkData } from "@/lib/types";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

interface ChapterSlot { workId: string; title: string; cover: string | null; coverColor: string | null; nextChapter: number | null; when: string; stale: boolean; }

/** Episódio da grade semanal: só os campos que o CalendarView realmente usa.
 *  extLinks vem do extMap (busca dedicada). */
function episodeSlot(w: WorkData, extLinks: any[]) {
  return {
    id: w.id, title: w.title, cover: w.cover, coverColor: w.coverColor,
    nextEpisodeAt: w.nextEpisodeAt, nextEpisodeNum: w.nextEpisodeNum,
    extLinks,
  };
}

const g = globalThis as unknown as { __schedCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

export async function GET(req: NextRequest) {
  if (g.__schedCache && Date.now() - g.__schedCache.at < TTL) {
    return cachedJson({ ok: true, ...g.__schedCache.data, cached: true });
  }
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);
  try {
  const now = Date.now();

  // --- Semana: animes com próximo episódio datado (janela −1d a +9d) ---
  const airing = (await selectCards(
    `"type" = 'anime' AND "nextEpisodeAt" IS NOT NULL AND ${PUBLIC_GATE}`,
    [], `"nextEpisodeAt" ASC`, 300
  )).filter((w) => {
    const t = new Date(w.nextEpisodeAt!).getTime();
    return t > now - 86400000 && t < now + 9 * 86400000;
  });

  // extLinks: busca 1x para os no ar
  const extMap = new Map<string, any[]>();
  if (airing.length) {
    const rows = await db.work.findMany({
      where: { id: { in: airing.map((w) => w.id) } },
      select: { id: true, extLinks: true },
    }).catch(() => []);
    for (const r of rows) {
      try { extMap.set(r.id, r.extLinks ? JSON.parse(r.extLinks) : []); } catch { extMap.set(r.id, []); }
    }
  }

  const byWeekday: { day: number; items: ReturnType<typeof episodeSlot>[] }[] = Array.from({ length: 7 }, (_, day) => ({ day, items: [] }));
  for (const w of airing) {
    const d = new Date(w.nextEpisodeAt!);
    byWeekday[d.getDay()].items.push(episodeSlot(w, extMap.get(w.id) ?? []));
  }
  for (const d of byWeekday) d.items.sort((a, b) => (a.nextEpisodeAt ?? "").localeCompare(b.nextEpisodeAt ?? ""));

  // --- Semana: capítulos estimados (mesmo helper central das seções da home) ---
  const chapterPool = await selectCards(
    `"type" IN ('manga','manhwa','manhua') AND "status" = 'RELEASING' AND "lastUpdate" IS NOT NULL AND "cover" != '' AND ${PUBLIC_GATE}`,
    [], `"popularity" DESC`, 120
  );
  const estimates = estimateChapterReleases(chapterPool, 90);
  const chaptersByWeekday = Array.from({ length: 7 }, (_, day) => ({ day, items: [] as ChapterSlot[] }));
  for (const est of estimates) {
    const day = new Date(est.dateISO + "T12:00:00").getDay();
    chaptersByWeekday[day].items.push({
      workId: est.work.id,
      title: est.work.title,
      cover: est.work.cover ?? null,
      coverColor: est.work.coverColor ?? null,
      nextChapter: est.nextChapter,
      when: new Date(est.dateISO + "T12:00:00").toISOString(),
      stale: est.stale,
    });
  }
  for (const d of chaptersByWeekday) d.items.sort((a, b) => a.when.localeCompare(b.when));

  // --- Mês: estreias e retornos por data ---
  const monthItems = (await selectCards(
    `(CASE WHEN "type" = 'anime' AND "nextEpisodeAt" IS NOT NULL THEN substr("nextEpisodeAt",1,7) ELSE substr(COALESCE("startDate",''),1,7) END) = ? AND "cover" != '' AND ${PUBLIC_GATE}`,
    [month], `"popularity" DESC`, 60
  )).map(toCardWork);

  const data = { byWeekday, chaptersByWeekday, month, monthItems };
    g.__schedCache = { at: Date.now(), data };
    return cachedJson({ ok: true, ...data });
  } catch (e: any) {
    // isolamento: banco indisponível → stale na hora, senão ok:false (nunca 500)
    if (g.__schedCache?.data) return cachedJson({ ok: true, ...g.__schedCache.data, cached: true, stale: true });
    return cachedJson({ ok: false, error: String(e?.message ?? e) });
  }
}
