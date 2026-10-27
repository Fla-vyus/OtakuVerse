"use client";

import React, { memo, useState } from "react";
import { Star, BookOpen, Tv, Heart, Clapperboard } from "lucide-react";
import { usePortal } from "./store";
import { proxyImg } from "@/lib/imgurl";
import { TYPE_LABEL, CLASSIFICATION_LABEL, type WorkData } from "@/lib/types";

function fmt(n?: number | null): string {
  if (!n) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

function TypeIcon({ type }: { type: string }) {
  if (type === "anime") return <Tv className="h-3 w-3" />;
  if (type === "drama") return <Clapperboard className="h-3 w-3" />;
  return <BookOpen className="h-3 w-3" />;
}

/** Card de obra — capas reais via proxy multi-fonte; se ambas falharem, card de texto estilizado (nunca imagem fake) */
export const WorkCard = memo(function WorkCard({ work, rank }: { work: WorkData; rank?: number }) {
  const openWork = usePortal((s) => s.openWork);
  const [imgStage, setImgStage] = useState(0); // 0=proxy, 1=direta, 2=texto
  const proxy = proxyImg(work.cover, work.coverAlt);
  const direct = work.coverAlt ?? work.cover ?? null;

  const tagChips = work.tags.slice(0, 2).map((t) => t.name);
  const isAdult = work.classification === "adult";

  return (
    <button
      onClick={() => openWork(work.id)}
      className="cv-auto group relative w-full overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
      aria-label={`${work.title} — ${TYPE_LABEL[work.type]}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden" style={{ background: work.coverColor ? `${work.coverColor}22` : "var(--muted)" }}>
        {/* imagem real: proxy → direta no-referrer → card texto */}
        {imgStage < 2 && (
          <img
            src={imgStage === 0 ? (proxy ?? "") : (direct ?? "")}
            alt={`Capa de ${work.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgStage((s) => s + 1)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        )}
        {imgStage === 2 && (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center"
            style={{
              background: work.coverColor
                ? `linear-gradient(150deg, ${work.coverColor}cc, ${work.coverColor}55)`
                : "linear-gradient(150deg, var(--accent), var(--muted))",
            }}
          >
            <span className="line-clamp-4 text-sm font-black leading-tight" style={{ color: work.coverColor ? "#fff" : "var(--foreground)" }}>
              {work.title}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider opacity-80" style={{ color: work.coverColor ? "#fff" : "var(--muted-foreground)" }}>
              {TYPE_LABEL[work.type]}
            </span>
          </div>
        )}

        {typeof rank === "number" && (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-xs font-black text-white backdrop-blur">
            {rank}
          </span>
        )}

        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur">
          <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {work.avgScore ?? "—"}
        </span>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-6">
          <span className="flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur">
            <TypeIcon type={work.type} /> {TYPE_LABEL[work.type]}
          </span>
          {isAdult && (
            <span className="rounded-md bg-red-600/85 px-1.5 py-0.5 text-[9px] font-black uppercase text-white backdrop-blur">
              {work.adultTags?.[0] ?? "+18"}
            </span>
          )}
          {!isAdult && work.classification === "suggestive" && (
            <span className="rounded-md bg-pink-600/80 px-1.5 py-0.5 text-[9px] font-black uppercase text-white backdrop-blur">
              Ecchi
            </span>
          )}
        </div>
      </div>

      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[2.4rem] text-[13px] font-bold leading-snug">{work.title}</p>
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="line-clamp-1">{tagChips.join(" · ") || work.genres.slice(0, 2).join(" · ")}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{fmt(work.favourites)}</span>
          </span>
        </div>
      </div>
    </button>
  );
});

/** Linha horizontal rolável de cards */
export function CardRow({ items, ranks }: { items: WorkData[]; ranks?: boolean }) {
  if (!items.length) return null;
  return (
    <div className="no-scrollbar -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">
      {items.map((w, i) => (
        <div key={w.id} className="w-[150px] shrink-0 snap-start sm:w-[168px]">
          <WorkCard work={w} rank={ranks ? i + 1 : undefined} />
        </div>
      ))}
    </div>
  );
}

/** Grid responsivo de cards */
export function CardGrid({ items }: { items: WorkData[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((w) => (
        <WorkCard key={w.id} work={w} />
      ))}
    </div>
  );
}
