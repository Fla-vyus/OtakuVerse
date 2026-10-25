"use client";

import { memo, useState } from "react";
import { Star, Users, Heart, ChevronLeft, ChevronRight, Layers } from "lucide-react";
import { TYPE_LABEL, TYPE_COLORS, fmtNum, type WorkData, type WorkType } from "@/lib/types";
import { usePortal } from "./store";

export function TypeBadge({ type }: { type: WorkType }) {
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TYPE_COLORS[type]}`}>
      {TYPE_LABEL[type]}
    </span>
  );
}

export function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return null;
  const color = score >= 80 ? "text-emerald-300 bg-emerald-500/15 border-emerald-500/30"
    : score >= 70 ? "text-amber-300 bg-amber-500/15 border-amber-500/30"
    : "text-rose-300 bg-rose-500/15 border-rose-500/30";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-bold ${color}`}>
      <Star className="h-3 w-3 fill-current" /> {score}
    </span>
  );
}

function CoverImage({ work, className }: { work: WorkData; className?: string }) {
  const [err, setErr] = useState(false);
  if (err || !work.cover) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-violet-900/50 via-fuchsia-900/30 to-slate-900 p-2 ${className ?? ""}`}
        style={{ boxShadow: work.coverColor ? `inset 0 -40px 80px ${work.coverColor}22` : undefined }}
      >
        <span className="line-clamp-4 text-center text-xs font-semibold text-white/70">{work.title}</span>
      </div>
    );
  }
  return (
    <img
      src={work.cover}
      alt={`Capa de ${work.title}`}
      loading="lazy"
      onError={() => setErr(true)}
      className={className}
    />
  );
}

export const WorkCard = memo(function WorkCard({ work }: { work: WorkData }) {
  const openWork = usePortal((s) => s.openWork);
  return (
    <button
      onClick={() => openWork(work.id)}
      className="card-hover group relative w-full overflow-hidden rounded-xl border border-white/8 bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`Ver detalhes de ${work.title}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden">
        <CoverImage work={work} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        <div className="absolute left-1.5 top-1.5"><TypeBadge type={work.type} /></div>
        <div className="absolute right-1.5 top-1.5"><ScoreBadge score={work.avgScore} /></div>
        <div className="absolute inset-x-0 bottom-0 p-2">
          <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white drop-shadow">{work.title}</p>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-white/75">
            {work.type !== "anime" && work.chapters != null && (
              <span className="inline-flex items-center gap-0.5"><Layers className="h-3 w-3" /> {work.chapters} caps</span>
            )}
            {work.type === "anime" && work.episodes != null && (
              <span className="inline-flex items-center gap-0.5"><Layers className="h-3 w-3" /> {work.episodes} eps</span>
            )}
            <span className="inline-flex items-center gap-0.5"><Users className="h-3 w-3" /> {fmtNum(work.popularity)}</span>
          </div>
        </div>
      </div>
    </button>
  );
});

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-white/8 bg-card">
      <div className="shimmer aspect-[2/3] w-full" />
    </div>
  );
}

export function WorkRow({ title, subtitle, works, loading, id }: {
  title: string;
  subtitle?: string;
  works?: WorkData[] | null;
  loading?: boolean;
  id?: string;
}) {
  const scroll = (dir: number) => {
    const el = document.getElementById(id ?? title);
    el?.scrollBy({ left: dir * Math.max(320, (el.clientWidth ?? 600) * 0.8), behavior: "smooth" });
  };
  return (
    <section className="fade-up">
      <div className="mb-3 flex items-end justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground sm:text-[13px]">{subtitle}</p>}
        </div>
        <div className="hidden gap-1.5 sm:flex">
          <button onClick={() => scroll(-1)} aria-label="Rolar para esquerda"
            className="rounded-full border border-white/10 bg-secondary/60 p-2 text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => scroll(1)} aria-label="Rolar para direita"
            className="rounded-full border border-white/10 bg-secondary/60 p-2 text-muted-foreground transition hover:border-primary/40 hover:text-foreground">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        id={id ?? title}
        className="no-scrollbar flex snap-x gap-3 overflow-x-auto pb-1"
      >
        {loading && Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="w-[132px] shrink-0 snap-start sm:w-[152px]"><CardSkeleton /></div>
        ))}
        {works?.map((w) => (
          <div key={w.id} className="w-[132px] shrink-0 snap-start sm:w-[152px]">
            <WorkCard work={w} />
          </div>
        ))}
        {!loading && works && works.length === 0 && (
          <p className="py-8 text-sm text-muted-foreground">Nada por aqui ainda.</p>
        )}
      </div>
    </section>
  );
}

export function StatsMini({ work }: { work: WorkData }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      <ScoreBadge score={work.avgScore} />
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
        <Users className="h-3 w-3" /> {fmtNum(work.popularity)}
      </span>
      <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5">
        <Heart className="h-3 w-3" /> {fmtNum(work.favourites)}
      </span>
      <TypeBadge type={work.type} />
    </div>
  );
}
