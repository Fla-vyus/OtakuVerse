"use client";

import { useEffect, useState } from "react";
import { Trophy, Flame, Star, Heart, Layers, Crown } from "lucide-react";
import { TYPE_LABEL, fmtNum, type WorkData } from "@/lib/types";
import { usePortal } from "./store";
import { fetchJSON } from "@/lib/fetchClient";
import { usePersonal } from "./personal";
import { TypeBadge } from "./WorkCard";

const TYPES: { value: string; label: string }[] = [
  { value: "all", label: "Tudo" },
  { value: "manga", label: "Mangá" },
  { value: "manhwa", label: "Manhwa" },
  { value: "manhua", label: "Manhua" },
  { value: "lightnovel", label: "LN" },
  { value: "anime", label: "Anime" },
];

type Metric = "popular" | "score" | "favorites" | "chapters";

const METRICS: { key: Metric; label: string; icon: React.ReactNode; desc: string }[] = [
  { key: "popular", label: "Popularidade", icon: <Flame className="h-4 w-4" />, desc: "o que o mundo inteiro lê e assiste" },
  { key: "score", label: "Nota média", icon: <Star className="h-4 w-4" />, desc: "o pódio da crítica e da comunidade" },
  { key: "favorites", label: "Favoritos", icon: <Heart className="h-4 w-4" />, desc: "as obras que as pessoas amam de coração" },
  { key: "chapters", label: "Maratona", icon: <Layers className="h-4 w-4" />, desc: "mais capítulos/episódios para devorar" },
];

function metricText(w: WorkData, m: Metric): string {
  switch (m) {
    case "score": return `${w.avgScore ?? "—"}/100`;
    case "favorites": return `${fmtNum(w.favourites)} favoritos`;
    case "chapters": return w.type === "anime" ? `${w.episodes ?? "?"} eps` : `${w.chapters ?? "?"} caps`;
    default: return `${fmtNum(w.popularity)} no radar`;
  }
}

function PodiumCard({ w, rank, metric }: { w: WorkData; rank: 1 | 2 | 3; metric: Metric }) {
  const openWork = usePortal((s) => s.openWork);
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
  const ring = rank === 1 ? "border-primary/40 shadow-[0_10px_36px_-12px_rgba(180,83,9,0.4)]"
    : rank === 2 ? "border-border shadow-[0_8px_28px_-14px_rgba(120,113,108,0.4)]"
    : "border-primary/40 shadow-[0_8px_28px_-14px_rgba(154,59,18,0.35)]";

  return (
    <button
      onClick={() => openWork(w.id)}
      className={`card-hover group relative overflow-hidden rounded-2xl border bg-card text-left ${ring}`}
      aria-label={`${w.title} — posição ${rank}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden sm:aspect-[3/4]">
        <img src={w.cover} alt={`Capa de ${w.title}`} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <span className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-lg backdrop-blur-sm">{medal}</span>
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="font-display line-clamp-2 text-[13px] font-semibold leading-tight text-white drop-shadow sm:text-sm">{w.title}</p>
          <p className="mt-1 text-[11px] font-bold text-white/90">{metricText(w, metric)}</p>
        </div>
      </div>
    </button>
  );
}

function RankRow({ w, rank, metric }: { w: WorkData; rank: number; metric: Metric }) {
  const openWork = usePortal((s) => s.openWork);
  return (
    <button
      onClick={() => openWork(w.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-2 text-left transition hover:border-primary/25 hover:bg-white"
      aria-label={`${w.title} — posição ${rank}`}
    >
      <span className={`w-7 shrink-0 text-center font-display text-sm font-bold ${rank <= 10 ? "text-primary" : "text-muted-foreground"}`}>
        {rank}
      </span>
      <img src={w.cover} alt={`Capa de ${w.title}`} loading="lazy" className="h-14 w-10 shrink-0 rounded-md border border-border object-cover" />
      <div className="min-w-0 flex-1">
        <p className="font-display line-clamp-1 text-[13px] font-semibold">{w.title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <TypeBadge type={w.type} />
          <span className="text-[10px] text-muted-foreground">{TYPE_LABEL[w.type]}{w.country === "KR" ? " 🇰🇷" : w.country === "CN" || w.country === "TW" ? " 🇨🇳" : w.country === "JP" ? " 🇯🇵" : ""}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-display text-[12px] font-bold text-primary">{metricText(w, metric)}</p>
        {metric !== "score" && w.avgScore != null && <p className="text-[10px] text-muted-foreground">nota {w.avgScore}</p>}
      </div>
    </button>
  );
}

export function RankingsView() {
  const [type, setType] = useState("all");
  const [metric, setMetric] = useState<Metric>("popular");
  const [data, setData] = useState<{ key: string; items: WorkData[] } | null>(null);

  const key = `${type}|${metric}`;
  const loading = !data || data.key !== key;
  const ranked = data?.key === key ? data.items : [];

  useEffect(() => {
    let alive = true;
    fetchJSON<{ ok: boolean; items: any[] }>(`/api/rankings?type=${type}&metric=${metric}&adult=${usePersonal.getState().settings.adult ? "show" : "hide"}`)
      .then((d) => { if (alive && d?.ok) setData({ key, items: d.items }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [type, metric, key]);

  const rankedList = ranked;
  const podium = rankedList.slice(0, 3);
  const rest = rankedList.slice(3);
  const activeMetric = METRICS.find((m) => m.key === metric)!;

  return (
    <div className="fade-in space-y-5">
      <div>
        <div className="mb-0.5 flex items-center gap-2">
          <span className="overline-caps text-primary">Os melhores do acervo</span>
          <span className="h-px w-8 bg-border" aria-hidden />
        </div>
        <h1 className="font-display flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
          <Trophy className="h-6 w-6 text-[#b45309]" /> Rank<span className="text-gradient">ings</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Pódios e top 20 do catálogo, atualizados pelos dados da AniList.</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition ${
              metric === m.key
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:border-primary/25 hover:text-foreground"
            }`}
          >
            {m.icon}
            <span>
              <span className="block text-[13px] font-bold">{m.label}</span>
            </span>
          </button>
        ))}
      </div>

      {/* Tipos */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              type === t.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-white text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-muted-foreground">{activeMetric.desc}</span>
      </div>

      {loading || !data ? (
        <div className="space-y-3">
          <div className="shimmer h-56 rounded-2xl" />
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="shimmer h-16 rounded-xl" />)}
        </div>
      ) : rankedList.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Crown className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-bold">Sem dados para essa combinação</p>
        </div>
      ) : (
        <>
          {/* Pódio */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {podium.map((w, i) => (
              <div key={w.id} className={i === 0 ? "order-2 sm:order-none" : i === 1 ? "order-1 sm:order-none" : "order-3 sm:order-none"}>
                <PodiumCard w={w} rank={(i + 1) as 1 | 2 | 3} metric={metric} />
              </div>
            ))}
          </div>

          {/* Top 4–20 */}
          <div className="grid gap-2 md:grid-cols-2">
            {rest.map((w, i) => (
              <RankRow key={w.id} w={w} rank={i + 4} metric={metric} />
            ))}
          </div>

          {rankedList.length < 20 && (
            <p className="text-center text-xs text-muted-foreground">mostrando todos os {rankedList.length} qualificados</p>
          )}
        </>
      )}
    </div>
  );
}
