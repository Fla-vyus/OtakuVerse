"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Clock, Tv } from "lucide-react";
import { usePortal } from "./store";
import { WorkCard } from "./WorkCard";
import type { WorkData } from "@/lib/types";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function CalendarView() {
  const [data, setData] = useState<{ byWeekday: { day: number; items: WorkData[] }[]; month: string; monthItems: WorkData[] } | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const openWork = usePortal((s) => s.openWork);
  const loading = !data;

  const month = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + monthOffset);
    return d.toISOString().slice(0, 7);
  }, [monthOffset]);

  useEffect(() => {
    setData(null);
    fetch(`/api/schedule?month=${month}`)
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : null))
      .catch(() => {});
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
                          <img src={`/api/img?u=${encodeURIComponent(w.cover)}`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold">{w.title}</p>
                          <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" /> ep {w.nextEpisodeNum ?? "?"} · {d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
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

      {/* mês */}
      {data?.monthItems.length > 0 && (
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
