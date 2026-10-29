"use client";

import React, { memo, useState } from "react";
import { Star, BookOpen, Tv, Heart, Clapperboard, Bookmark, Check } from "lucide-react";
import { usePortal, prefetchWork } from "./store";
import { directCover, proxyImg } from "@/lib/imgurl";
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

/** Card de obra — v4.0: capa DIRETA do CDN (medium nas listas); se falhar, direta
 *  alternativa; se bloquear hotlink, proxy /api/img; se tudo falhar, card de texto
 *  estilizado (nunca imagem fake). No hover da capa aparecem as ações rápidas: curtir ❤️ e salvar 🔖 */
export const WorkCard = memo(function WorkCard({ work, rank, badge, caption }: { work: WorkData; rank?: number; badge?: string; caption?: string }) {
  // v4.0 — direto primeiro (CDN da fonte + cache do navegador); proxy é só fallback
  const primary = directCover(work, "medium");
  const alt = work.coverAlt ?? work.cover ?? null;
  const proxy = proxyImg(work.cover, work.coverAlt);
  // 0=direta-medium, 1=direta-full/alt, 2=proxy, 3=texto
  const [imgStage, setImgStage] = useState(primary ? 0 : alt ? 1 : proxy ? 2 : 3);

  const tagChips = work.tags.slice(0, 2).map((t) => t.name);
  const isAdult = work.classification === "adult";

  // ações rápidas na capa (curtir / salvar)
  const entry = usePortal((s) => s.library[work.id]);
  const upsertLocal = usePortal((s) => s.upsertLocal);
  const removeLocal = usePortal((s) => s.removeLocal);
  const user = usePortal((s) => s.user);
  const go = usePortal((s) => s.go);
  const liked = entry?.status === "favorite";
  const saved = !!entry && entry.status !== "favorite";

  function actLike(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      go("auth");
      return;
    }
    if (liked) removeLocal(work.id);
    else upsertLocal({ workId: work.id, status: "favorite", rating: entry?.rating ?? null, note: entry?.note ?? null, updatedAt: new Date().toISOString() });
  }
  function actSave(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      go("auth");
      return;
    }
    if (entry) removeLocal(work.id);
    else upsertLocal({ workId: work.id, status: "plan", rating: null, note: null, updatedAt: new Date().toISOString() });
  }

  return (
    <a
      href={`#/obra/${work.id}`}
      // prefetch: hover/tecla/toque já baixa o detalhe — o clique abre sem spinner
      onPointerEnter={() => prefetchWork(work.id)}
      onFocus={() => prefetchWork(work.id)}
      onTouchStart={() => prefetchWork(work.id)}
      className="cv-auto group relative block w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      aria-label={`${work.title} — ${TYPE_LABEL[work.type]}`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden" style={{ background: work.coverColor ? `${work.coverColor}22` : "var(--muted)" }}>
        {/* v4.0: direta medium → direta alt/full → proxy → card texto */}
        {imgStage === 0 && primary && (
          <img
            src={primary}
            alt={`Capa de ${work.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgStage(alt && alt !== primary ? 1 : proxy ? 2 : 3)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        )}
        {imgStage === 1 && alt && (
          <img
            src={alt}
            alt={`Capa de ${work.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgStage(proxy ? 2 : 3)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        )}
        {imgStage === 2 && proxy && (
          <img
            src={proxy}
            alt={`Capa de ${work.title}`}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setImgStage(3)}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
          />
        )}
        {imgStage === 3 && (
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

        {typeof rank === "number" && !badge && (
          <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-xs font-black text-white backdrop-blur">
            {rank}
          </span>
        )}
        {badge && (
          <span className="bg-brand-gradient absolute left-2 top-2 rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white shadow-md">
            {badge}
          </span>
        )}

        {/* ações rápidas na capa — curtir & salvar (aparecem no hover) */}
        <div className="ov-actions absolute right-2 top-2 z-10 flex flex-col gap-1.5">
          <button
            onClick={actLike}
            aria-label={liked ? "Remover curtida" : "Curtir"}
            title={liked ? "Curtida — clique para remover" : "Curtir ❤️"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-lg backdrop-blur transition hover:scale-110 ${
              liked ? "border-red-400/60 bg-red-500/90 text-white" : "border-white/20 bg-black/55 text-white hover:bg-black/75"
            }`}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={actSave}
            aria-label={saved ? "Remover da biblioteca" : "Salvar na biblioteca"}
            title={saved ? "Salvo na biblioteca — clique para remover" : "Salvar 🔖"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border shadow-lg backdrop-blur transition hover:scale-110 ${
              saved ? "border-amber-300/60 bg-amber-500/90 text-white" : "border-white/20 bg-black/55 text-white hover:bg-black/75"
            }`}
          >
            {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          </button>
        </div>

        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-6">
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
          <span className="ml-auto flex items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur">
            <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" /> {work.avgScore ?? "—"}
          </span>
        </div>
      </div>

      <div className="p-2.5">
        <p className="line-clamp-2 min-h-[2.4rem] text-[13px] font-bold leading-snug">{work.title}</p>
        {caption && <p className="mt-0.5 line-clamp-1 text-[10px] font-bold text-primary">{caption}</p>}
        <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="line-clamp-1">{tagChips.join(" · ") || work.genres.slice(0, 2).join(" · ")}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" />{fmt(work.favourites)}</span>
          </span>
        </div>
      </div>
    </a>
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
    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((w) => (
        <WorkCard key={w.id} work={w} />
      ))}
    </div>
  );
}

// ---------- Peças compartilhadas (usadas em Rankings/Releases/Streaming/Para Você) ----------

/** Chip do formato da obra */
export function TypeBadge({ type }: { type: string }) {
  const t = (TYPE_LABEL[type as WorkData["type"]] ? type : "manga") as WorkData["type"];
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-foreground">
      <TypeIcon type={t} /> {TYPE_LABEL[t]}
    </span>
  );
}

/** Nota com estrela */
export function ScoreBadge({ score }: { score?: number | null }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-bold">
      <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> {score ?? "—"}
    </span>
  );
}

/** Capa miniatura com fallback direto → proxy → bloco de cor (nunca imagem fake) */
export function CoverThumb({ work, className }: { work: WorkData; className?: string }) {
  const primary = directCover(work, "medium");
  const alt = work.coverAlt ?? work.cover ?? null;
  const proxy = proxyImg(work.cover, work.coverAlt);
  const [stage, setStage] = useState(primary ? 0 : alt ? 1 : proxy ? 2 : 3);
  if (stage === 3 || (!primary && !alt && !proxy)) {
    return (
      <div
        className={`flex items-center justify-center text-[10px] font-black text-white ${className ?? ""}`}
        style={{ background: work.coverColor ?? "var(--accent)" }}
        aria-label={`Capa de ${work.title}`}
      >
        {work.title.slice(0, 14)}
      </div>
    );
  }
  const src = stage === 0 ? primary : stage === 1 ? alt : proxy;
  return (
    <img
      src={src ?? undefined}
      alt={`Capa de ${work.title}`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setStage(stage === 0 ? (alt && alt !== primary ? 1 : proxy ? 2 : 3) : stage === 1 ? (proxy ? 2 : 3) : 3)}
      className={className}
    />
  );
}

/** Card do "Para Você" com % de afinidade e motivos da recomendação */
export function ForYouCard({ work, match, reasons, highlight }: { work: WorkData; match: number; reasons: string[]; highlight?: boolean }) {
  const pct = Math.max(40, Math.min(99, Math.round(60 + match * 8)));
  return (
    <a
      href={`#/obra/${work.id}`}
      onPointerEnter={() => prefetchWork(work.id)}
      onTouchStart={() => prefetchWork(work.id)}
      className={`cv-auto group relative block w-full cursor-pointer overflow-hidden rounded-2xl border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
        highlight ? "border-primary/70 ring-2 ring-primary/40" : "border-border"
      }`}
    >
      <CoverThumb work={work} className="aspect-[2/3] w-full object-cover" />
      <span className="bg-brand-gradient absolute right-1.5 top-1.5 rounded-lg px-1.5 py-0.5 text-[10px] font-black text-white shadow">
        {pct}%
      </span>
      <div className="p-2">
        <p className="line-clamp-2 min-h-[2.3rem] text-[12px] font-bold leading-snug">{work.title}</p>
        {reasons.length > 0 && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-primary">✨ {reasons.join(" · ")}</p>
        )}
      </div>
    </a>
  );
}

/** Esqueleto de carregamento (mesma forma do WorkCard) */
export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card" aria-hidden>
      <div className="skel aspect-[2/3] w-full" />
      <div className="space-y-1.5 p-2.5">
        <div className="skel h-3 w-4/5 rounded" />
        <div className="skel h-2.5 w-2/5 rounded" />
      </div>
    </div>
  );
}
