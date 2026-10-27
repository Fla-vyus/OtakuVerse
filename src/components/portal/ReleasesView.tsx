"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, Loader2, Tv } from "lucide-react";
import { TYPE_LABEL, fmtNum, type WorkData } from "@/lib/types";
import { usePortal } from "./store";
import { TypeBadge, ScoreBadge, CoverThumb } from "./WorkCard";

interface ReleaseItem {
  work: WorkData;
  label: string;
  detail: string;
  dateISO: string;
  kind: "anime" | "estimado";
  weekday: number;
}

export function ReleasesView() {
  const openWork = usePortal((s) => s.openWork);
  const [days, setDays] = useState<{ weekday: number; label: string; items: ReleaseItem[] }[] | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/releases")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setDays(d.days);
          const today = new Date().getDay();
          setSelected(today);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().getDay();
  const shown = selected == null ? null : days?.find((d) => d.weekday === selected) ?? null;

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <CalendarDays className="h-6 w-6 text-primary" /> Lançamentos da semana
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Calendário com o que estreia capítulo/episódio a cada dia — datas REAIS de episódios (animes e doramas) e estimativas honestas (marcadas) para mangás em lançamento. Atualiza sozinho.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* abas de dia */}
          <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
            {days?.map((d) => (
              <button
                key={d.weekday}
                onClick={() => setSelected(d.weekday)}
                className={`flex min-w-[92px] flex-col items-center rounded-xl border px-4 py-2.5 transition ${
                  selected === d.weekday
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-sm font-extrabold">{d.label}</span>
                <span className="text-[11px]">
                  {d.weekday === today ? "hoje · " : ""}{d.items.length} lanç.
                </span>
              </button>
            ))}
          </div>

          {shown && shown.items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
              Nenhum lançamento previsto para {shown.label.toLowerCase()}. Confira os outros dias.
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown?.items.map((it) => (
              <button
                key={it.work.id + it.label}
                onClick={() => openWork(it.work.id)}
                className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left"
              >
                <CoverThumb work={it.work} className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-1.5">
                    <TypeBadge type={it.work.type} />
                    {it.kind === "anime" && (
                      <span className="inline-flex items-center gap-0.5 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                        <Tv className="h-3 w-3" /> data real
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-sm font-bold">{it.work.title}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock3 className="h-3 w-3" />
                    <span className="font-bold text-foreground">{it.label}</span> · {it.detail}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <ScoreBadge score={it.work.avgScore} />
                    <span className="text-[11px] text-muted-foreground">{fmtNum(it.work.popularity)} leitores</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <p className="mt-6 rounded-xl border border-border bg-card/60 p-3 text-center text-xs text-muted-foreground">
            💡 O calendário é <b className="text-foreground">perpétuo</b>: obras semanais sempre aparecem no dia em que o próximo capítulo deve cair, e animes usam a data real de exibição da AniList.
          </p>
        </>
      )}
    </div>
  );
}
