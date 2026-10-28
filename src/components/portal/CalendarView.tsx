"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Clock, Tv, BookOpen } from "lucide-react";
import { usePortal } from "./store";
import { fetchJSON } from "@/lib/fetchClient";
import { WorkCard } from "./WorkCard";
import type { WorkData } from "@/lib/types";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const STREAMING_SITES: Record<string, string> = {
  Netflix: "Netflix",
  Crunchyroll: "Crunchyroll",
  "Amazon Prime Video": "Prime Video",
  Hulu: "Hulu",
  HIDIVE: "HIDIVE",
  BilibiliTV: "Bilibili",
  "iQ.com": "iQIYI",
  MuseAsia: "Muse Asia",
  "Ani-One": "Ani-One",
  Viki: "Viki",
  "Viki (Rakuten)": "Viki",
  DisneyPlus: "Disney+",
};

function streamOf(w: WorkData): string | null {
  for (const l of w.extLinks ?? []) {
    if (STREAMING_SITES[l.site] && (l.type ?? "").toUpperCase().includes("STREAM")) return STREAMING_SITES[l.site];
  }
  for (const l of w.extLinks ?? []) {
    if (STREAMING_SITES[l.site]) return STREAMING_SITES[l.site];
  }
  return null;
}

export function CalendarView() {
  const [data, setData] = useState<{
    byWeekday: { day: number; items: WorkData[] }[];
    chaptersByWeekday: { day: number; items: { workId: string; title: string; cover: string | null; coverColor: string | null; nextChapter: number | null; when: string; stale: boolean }[] }[];
    month: string; monthItems: WorkData[];
  } | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const openWork = usePortal((s) => s.openWork);

  const month = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.toISOString().slice(0, 7);
  }, [monthOffset]);

  const loading = !data || data.month !== month;

  useEffect(() => {
    let alive = true;
    // timeout + 3 tentativas — rede instável nunca deixa o calendário em spinner infinito
    fetchJSON(`/api/schedule?month=${month}`).then((d) => {
      if (alive && d?.ok) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [month]);

  const today = new Date().getDay();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <CalendarDays className="h-6 w-6 text-primary" /> Calendário de Lançamentos
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">Datas reais de exibição (animes em exibição) + estreias do catálogo, atualizado automaticamente</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMonthOffset((m) => m - 1)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card" aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-32 text-center text-sm font-black capitalize">
            {new Date(month + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setMonthOffset((m) => Math.min(0, m + 1))} disabled={monthOffset >= 0} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card disabled:opacity-40" aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* semana */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-sm font-black"><Tv className="h-4 w-4 text-primary" /> Esta semana — próximos episódios</p>
        {loading ? (
          <div className="py-12 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data?.byWeekday.map(({ day, items }) => (
              <div key={day} className={`rounded-2xl border p-3.5 ${day === today ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <p className={`mb-2.5 flex items-center justify-between text-xs font-black uppercase tracking-wider ${day === today ? "text-primary" : "text-muted-foreground"}`}>
                  {WEEKDAYS[day]}
                  {day === today && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] text-white">hoje</span>}
                </p>
                <div className="flex flex-col gap-1.5">
                  {items.length === 0 && <p className="py-2 text-[11px] text-muted-foreground">sem episódios datados</p>}
                  {items.slice(0, 6).map((w) => {
                    const d = new Date(w.nextEpisodeAt!);
                    return (
                      <button key={w.id} onClick={() => openWork(w.id)} className="flex items-center gap-2 rounded-xl bg-secondary/70 px-2.5 py-2 text-left transition hover:bg-accent">
                        <div className="h-11 w-8 shrink-0 overflow-hidden rounded-md" style={{ background: w.coverColor ? `${w.coverColor}33` : "var(--muted)" }}>
                          {w.cover ? (
                            <img src={`/api/img?u=${encodeURIComponent(w.cover)}`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[8px] font-black text-muted-foreground">{w.title.slice(0, 2).toUpperCase()}</div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold">{w.title}</p>
                          <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5 shrink-0" /> ep {w.nextEpisodeNum ?? "?"} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                            {streamOf(w) && (
                              <span className="ml-auto shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-black text-primary">{streamOf(w)}</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* semana: capítulos */}
      <section>
        <p className="mb-3 flex items-center gap-2 text-sm font-black"><BookOpen className="h-4 w-4 text-primary" /> Esta semana — lançamentos de capítulos <span className="text-[10px] font-semibold text-muted-foreground">(estimativa semanal das séries ativas)</span></p>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data?.chaptersByWeekday.map(({ day, items }) => (
              <div key={day} className={`rounded-2xl border p-3.5 ${day === today ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
                <p className={`mb-2.5 flex items-center justify-between text-xs font-black uppercase tracking-wider ${day === today ? "text-primary" : "text-muted-foreground"}`}>
                  {WEEKDAYS[day]}
                  {day === today && <span className="rounded-md bg-primary px-1.5 py-0.5 text-[9px] text-white">hoje</span>}
                </p>
                <div className="flex flex-col gap-1.5">
                  {items.length === 0 && <p className="py-2 text-[11px] text-muted-foreground">sem capítulos previstos</p>}
                  {items.slice(0, 6).map((c) => (
                    <button key={c.workId} onClick={() => openWork(c.workId)} className="flex items-center gap-2 rounded-xl bg-secondary/70 px-2.5 py-2 text-left transition hover:bg-accent">
                      <div className="h-11 w-8 shrink-0 overflow-hidden rounded-md" style={{ background: c.coverColor ? `${c.coverColor}33` : "var(--muted)" }}>
                        {c.cover ? (
                          <img src={`/api/img?u=${encodeURIComponent(c.cover)}`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[8px] font-black text-muted-foreground">{c.title.slice(0, 2).toUpperCase()}</div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-bold">{c.title}</p>
                        <p className="flex items-center gap-1.5 text-[10px] font-bold text-primary">
                          {c.nextChapter ? `cap ${c.nextChapter}` : "novo cap"}
                          {c.stale ? (
                            <span className="ml-auto rounded bg-secondary px-1.5 py-0.5 text-[9px] font-black text-muted-foreground">a qualquer momento</span>
                          ) : (
                            <span className="ml-auto flex items-center gap-0.5 text-[9px] text-muted-foreground">
                              <Clock className="h-2.5 w-2.5" /> {new Date(c.when).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* mês */}
      {data && data.monthItems.length > 0 && (
        <section>
          <p className="mb-3 text-sm font-black">Estreias e eventos de {new Date(month + "-15T12:00:00").toLocaleDateString("pt-BR", { month: "long" })}</p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {data.monthItems.slice(0, 24).map((w) => <WorkCard key={w.id} work={w} />)}
          </div>
        </section>
      )}
    </div>
  );
}
