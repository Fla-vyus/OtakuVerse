"use client";

import { useEffect, useState } from "react";
import { Tv, Loader2, CalendarDays, Radio } from "lucide-react";
import { TYPE_LABEL, fmtNum, type WorkData } from "@/lib/types";
import { usePortal } from "./store";
import { ScoreBadge, CoverThumb } from "./WorkCard";

interface StreamingEntry {
  work: WorkData;
  kind: "anime" | "drama";
  nextISO: string | null;
  live: boolean;
  premieredThisMonth: boolean;
}
interface PlatformGroup {
  platform: string;
  color: string;
  kind: string;
  entries: StreamingEntry[];
}

function nextLabel(nextISO: string | null): string {
  if (!nextISO) return "em exibição";
  const d = new Date(nextISO);
  const diff = d.getTime() - Date.now();
  if (diff < 0) return "episódio recente";
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 48) return `próx. ep em ${hrs}h`;
  return `próx. ep ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
}

export function StreamingView() {
  const openWork = usePortal((s) => s.openWork);
  const [data, setData] = useState<{ groups: PlatformGroup[]; label: string; total: number } | null>(null);
  const [platform, setPlatform] = useState<string>("all");

  const loading = !data;

  useEffect(() => {
    let alive = true;
    fetch("/api/streaming")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && alive) setData({ groups: d.groups, label: d.label, total: d.total });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const shown = data?.groups.filter((g) => platform === "all" || g.platform === platform) ?? [];

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <Tv className="h-6 w-6 text-primary" /> Onde assistir agora
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Plataformas <b className="text-foreground">reais</b> — Crunchyroll, Netflix e cia. vêm dos links oficiais de cada obra, e emissoras como tvN/JTBC vêm do cadastro dos doramas. Datas de episódios são as reais (AniList / TVMaze).
          {data?.label ? ` · dados de ${data.label}` : ""}
        </p>
      </div>

      {/* filtro de plataformas */}
      <div className="no-scrollbar mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setPlatform("all")}
          className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${platform === "all" ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
        >
          Todas {data?.total ? `· ${data.total}` : ""}
        </button>
        {data?.groups.map((g) => (
          <button
            key={g.platform}
            onClick={() => setPlatform(g.platform)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${platform === g.platform ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground"}`}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: g.color }} />
            {g.platform} · {g.entries.length}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : shown.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">Nada no ar neste momento — sincronização em andamento.</p>
      ) : (
        <div className="space-y-7">
          {shown.map((g) => (
            <section key={g.platform}>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
                {g.platform}
                <span className="text-xs font-semibold text-muted-foreground">
                  {g.kind === "canal" ? "emissora de doramas" : "plataforma"} · {g.entries.length} título(s)
                </span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.entries.map((e) => (
                  <button key={g.platform + e.work.id} onClick={() => openWork(e.work.id)} className="card-hover flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left">
                    <CoverThumb work={e.work} className="h-20 w-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-bold">{e.work.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                        <span className="rounded bg-secondary px-1.5 py-0.5 font-bold text-foreground">{TYPE_LABEL[e.work.type]}</span>
                        <span className="inline-flex items-center gap-0.5"><Radio className="h-3 w-3" /> {nextLabel(e.nextISO)}</span>
                        {e.premieredThisMonth && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1.5 py-0.5 font-bold text-primary"><CalendarDays className="h-3 w-3" /> estreia neste mês</span>
                        )}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <ScoreBadge score={e.work.avgScore} />
                        <span className="text-[11px] text-muted-foreground">{fmtNum(e.work.popularity)} fãs</span>
                        {e.live && (
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">no ar</span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}

          <p className="rounded-xl border border-border bg-card/60 p-3 text-center text-xs text-muted-foreground">
            💡 Tudo aqui é real: plataformas de <b className="text-foreground">animes</b> vêm dos links oficiais cadastrados na AniList; <b className="text-foreground">doramas</b> mostram a emissora/streaming real do cadastro (Netflix, tvN, JTBC, Viki, U-Next...). As datas de próximo episódio são timestamps oficiais.
          </p>
        </div>
      )}
    </div>
  );
}
