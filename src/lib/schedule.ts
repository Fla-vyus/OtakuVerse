// Calendário de lançamentos + grade de streaming — 100% dados REAIS:
// animes/doramas com timestamp REAL do próximo episódio (AniList nextAiringEpisode / TVMaze airstamp)
// e plataformas reais (links de streaming da AniList + emissoras reais da TVMaze).
import { db } from "@/lib/db";
import { parseWork, type WorkData } from "@/lib/types";

const DAY = 86400000;

export interface ReleaseItem {
  work: WorkData;
  label: string; // "Cap 148" | "Ep 7"
  detail: string;
  dateISO: string;
  kind: "anime" | "estimado";
  weekday: number; // 0=dom
}

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** Desloca lastUpdate em semanas para estimativa honesta e rotulada como estimativa */
function perpetuate(lastUnix: number): Date {
  const last = lastUnix * 1000;
  if (last >= Date.now() - 7 * DAY) return new Date(last + 7 * DAY);
  const k = Math.ceil((Date.now() - last) / (7 * DAY));
  return new Date(last + k * 7 * DAY);
}

export async function getWeeklyReleases(maxPerDay = 16): Promise<{ days: { weekday: number; label: string; items: ReleaseItem[] }[] }> {
  const now = Date.now();
  const in7 = now + 7.2 * DAY;

  const [releasing, airing] = await Promise.all([
    db.work.findMany({
      where: { status: "RELEASING", type: { in: ["manga", "manhwa", "manhua", "lightnovel"] }, isAdult: false, lastUpdate: { not: null }, popularity: { gte: 3000 } },
      orderBy: { popularity: "desc" },
      take: 420,
    }),
    db.work.findMany({
      where: { status: "RELEASING", type: { in: ["anime", "drama"] }, isAdult: false, nextEpisodeAt: { not: null } },
      orderBy: { popularity: "desc" },
      take: 160,
    }),
  ]);

  const byDay = new Map<number, ReleaseItem[]>();
  const push = (d: Date, item: Omit<ReleaseItem, "weekday">) => {
    const wd = d.getDay();
    if (!byDay.has(wd)) byDay.set(wd, []);
    const arr = byDay.get(wd)!;
    if (arr.length < maxPerDay) arr.push({ ...item, weekday: wd } as ReleaseItem);
  };

  for (const raw of airing) {
    const w = parseWork(raw);
    const t = w.nextEpisodeAt ? new Date(w.nextEpisodeAt) : null;
    if (!t || t.getTime() > in7 || t.getTime() < now - DAY) continue;
    push(t, {
      work: w,
      label: `Ep ${w.nextEpisodeNum ?? "?"}`,
      detail: t.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" }),
      dateISO: t.toISOString(),
      kind: "anime",
    });
  }

  for (const raw of releasing) {
    const w = parseWork(raw);
    if (!w.lastUpdate) continue;
    const next = perpetuate(w.lastUpdate);
    if (next.getTime() > in7) continue;
    const t = new Date(next.getTime());
    const past = next.getTime() < now;
    push(t, {
      work: w,
      label: w.type === "lightnovel" ? `Vol ${Math.max(1, Math.ceil((w.chapters ?? 10) / 9) + 1)}` : `Cap ${(w.chapters ?? 20) + 1}`,
      detail: past ? "a qualquer momento (estimado)" : WEEKDAYS[t.getDay()],
      dateISO: t.toISOString(),
      kind: "estimado",
    });
  }

  const days = [1, 2, 3, 4, 5, 6, 0].map((wd) => ({
    weekday: wd,
    label: WEEKDAYS[wd],
    items: (byDay.get(wd) ?? []).sort((a, b) => a.dateISO.localeCompare(b.dateISO)),
  }));
  return { days };
}

// ---------- Grade de streaming (plataformas REAIS) ----------

export interface StreamingEntry {
  work: WorkData;
  kind: "anime" | "drama";
  nextISO: string | null; // próxima exibição REAL (airstamp/nextAiring)
  live: boolean; // está no ar agora (RELEASING)
  premieredThisMonth: boolean;
}

export interface PlatformGroup {
  platform: string;
  color: string;
  kind: string; // "streaming" | "canal" | "webtoon"
  entries: StreamingEntry[];
}

const PLATFORM_COLORS: Record<string, string> = {
  "Crunchyroll": "#f47521",
  "Netflix": "#e50914",
  "Prime Video": "#00a8e1",
  "Amazon Prime Video": "#00a8e1",
  "Disney+": "#113ccf",
  "Max": "#8a2be2",
  "Hulu": "#1ce783",
  "Bilibili TV": "#00a1d6",
  "Muse Asia": "#ff5a5f",
  "Ani-One": "#4f9cf9",
  "HIDIVE": "#00c4cc",
  "iQ.com": "#8be94f",
  "Anime Onegai": "#ff9f43",
  "Viki": "#31d0aa",
  "U-Next": "#e8425a",
  "tvN": "#ff4d4d",
  "JTBC": "#b3a2ff",
  "OCN": "#111111",
  "SBS": "#2b5cff",
  "KBS": "#0aa0e0",
  "MBC": "#3ba3ff",
  "ENA": "#ff7b54",
  "TV Chosun": "#d4af37",
  "Channel A": "#e05c8a",
  "Netflix Anime": "#e50914",
  "YouTube": "#ff0000",
};

function colorFor(platform: string): string {
  return PLATFORM_COLORS[platform] ?? "#64748b";
}

function streamingSites(links: { site: string; type?: string | null }[]): string[] {
  const out: string[] = [];
  for (const l of links) {
    if (l.type === "STREAMING" && l.site && !/^Site oficial|MangaDex|MyAnimeList|LiveChart|ANN$/i.test(l.site)) {
      out.push(l.site);
    }
  }
  return out;
}

export async function getStreamingSchedule(): Promise<{ label: string; generatedAt: string; groups: PlatformGroup[]; total: number }> {
  const now = Date.now();
  const nowDate = new Date();
  const monthStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), 1).getTime();

  const [animeRows, dramaRows] = await Promise.all([
    db.work.findMany({
      where: { type: "anime", isAdult: false, OR: [{ status: "RELEASING", nextEpisodeAt: { not: null } }, { status: "NOT_YET_RELEASED", startDate: { not: null } }] },
      orderBy: { popularity: "desc" },
      take: 300,
    }),
    db.work.findMany({
      where: { type: "drama", isAdult: false, OR: [{ status: "RELEASING" }, { status: "NOT_YET_RELEASED" }] },
      orderBy: { popularity: "desc" },
      take: 120,
    }),
  ]);

  const groups = new Map<string, PlatformGroup>();
  const pushEntry = (platform: string, kind: string, entry: StreamingEntry) => {
    if (!platform) return;
    if (!groups.has(platform)) groups.set(platform, { platform, color: colorFor(platform), kind, entries: [] });
    const g = groups.get(platform)!;
    if (g.entries.length < 30) g.entries.push(entry);
  };

  for (const raw of animeRows) {
    const w = parseWork(raw);
    const nextISO = w.nextEpisodeAt ?? null;
    const nextT = nextISO ? new Date(nextISO).getTime() : 0;
    // temporada viva: episódio futuro ou recente (última exibição < 45 dias) ou estreia futura
    const alive = (nextT > now - 45 * DAY) || (w.startDate ? new Date(w.startDate + "T00:00:00").getTime() > now - 45 * DAY : false);
    if (!alive) continue;
    const premieredThisMonth = !!w.startDate && new Date(w.startDate + "T00:00:00").getTime() >= monthStart;
    const entry: StreamingEntry = { work: w, kind: "anime", nextISO, live: w.status === "RELEASING", premieredThisMonth };
    const platforms = streamingSites(w.extLinks);
    if (platforms.length === 0) {
      pushEntry("Sem streaming confirmado", "streaming", entry);
    } else {
      for (const p of platforms.slice(0, 3)) pushEntry(p, "streaming", entry);
    }
  }

  for (const raw of dramaRows) {
    const w = parseWork(raw);
    const nextISO = w.nextEpisodeAt ?? null;
    const nextT = nextISO ? new Date(nextISO).getTime() : 0;
    const alive = (nextT > now - 45 * DAY) || (w.startDate ? new Date(w.startDate + "T00:00:00").getTime() > now - 60 * DAY : false);
    if (!alive) continue;
    const premieredThisMonth = !!w.startDate && new Date(w.startDate + "T00:00:00").getTime() >= monthStart;
    const entry: StreamingEntry = { work: w, kind: "drama", nextISO, live: w.status === "RELEASING", premieredThisMonth };
    const platform = w.source; // emissora/plataforma REAL (Netflix, tvN, Viki, U-Next...)
    if (!platform || /^(tvN|JTBC|OCN|SBS|KBS|MBC|ENA|TV Chosun|Channel A)$/i.test(platform)) {
      pushEntry(/tv|KBS|MBC|SBS|JTBC|OCN|ENA|Chosun|Channel/i.test(platform ?? "") ? platform ?? "Canais coreanos" : "Canais coreanos", "canal", entry);
    } else {
      pushEntry(platform, "streaming", entry);
    }
  }

  const out = [...groups.values()];
  for (const g of out) {
    g.entries.sort((a, b) => {
      if (a.nextISO && b.nextISO) return a.nextISO.localeCompare(b.nextISO);
      if (a.nextISO) return -1;
      if (b.nextISO) return 1;
      return (b.work.popularity ?? 0) - (a.work.popularity ?? 0);
    });
  }
  out.sort((a, b) => {
    const liveA = a.entries.filter((e) => e.live).length;
    const liveB = b.entries.filter((e) => e.live).length;
    return liveB - liveA || b.entries.length - a.entries.length;
  });

  const label = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return {
    label: label.charAt(0).toUpperCase() + label.slice(1),
    generatedAt: new Date().toISOString(),
    groups: out,
    total: out.reduce((a, g) => a + g.entries.length, 0),
  };
}
