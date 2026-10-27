// Calendário: animes em exibição agrupados por dia da semana (dados reais de
// nextEpisodeAt) + capítulos estimados das séries ativas + grade do mês.
import { NextRequest, NextResponse } from "next/server";
import { getAllWorks, estimateChapterReleases } from "@/lib/works";

export const dynamic = "force-dynamic";

interface ChapterSlot { workId: string; title: string; cover: string | null; coverColor: string | null; nextChapter: number | null; when: string; stale: boolean; }

const g = globalThis as unknown as { __schedCache?: { at: number; data: any } };
const TTL = 10 * 60_000;

export async function GET(req: NextRequest) {
  if (g.__schedCache && Date.now() - g.__schedCache.at < TTL) {
    return NextResponse.json({ ok: true, ...g.__schedCache.data, cached: true });
  }
  const sp = req.nextUrl.searchParams;
  const month = sp.get("month") ?? new Date().toISOString().slice(0, 7);
  const all = await getAllWorks();
  const now = Date.now();

  // --- Semana: animes com próximo episódio datado ---
  const airing = all
    .filter((w) => w.type === "anime" && w.nextEpisodeAt && new Date(w.nextEpisodeAt).getTime() > now - 86400000)
    .filter((w) => new Date(w.nextEpisodeAt!).getTime() < now + 9 * 86400000);

  const byWeekday: { day: number; items: typeof airing }[] = Array.from({ length: 7 }, (_, day) => ({ day, items: [] }));
  for (const w of airing) {
    const d = new Date(w.nextEpisodeAt!);
    byWeekday[d.getDay()].items.push(w);
  }
  for (const d of byWeekday) d.items.sort((a, b) => (a.nextEpisodeAt ?? "").localeCompare(b.nextEpisodeAt ?? ""));

  // --- Semana: capítulos estimados (mesmo helper central das seções da home) ---
  const estimates = estimateChapterReleases(all, 90);
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
  const monthItems = all
    .filter((w) => {
      const d = w.type === "anime" && w.nextEpisodeAt ? w.nextEpisodeAt.slice(0, 7) : (w.startDate ?? "").slice(0, 7);
      return d === month && w.cover;
    })
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, 60);

  const data = { byWeekday, chaptersByWeekday, month, monthItems };
  g.__schedCache = { at: Date.now(), data };
  return NextResponse.json({ ok: true, ...data });
}
