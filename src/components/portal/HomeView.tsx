"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Star, Users, Layers, ChevronLeft, ChevronRight, Flame, CalendarDays, Languages, BookOpen, MonitorPlay, Crown } from "lucide-react";
import { TYPE_LABEL, fmtNum, fmtDate, type WorkData, type WorkType } from "@/lib/types";
import { usePortal } from "./store";
import { WorkRow, TypeBadge, ScoreBadge } from "./WorkCard";

const HERO_COUNT = 6;

function Hero({ works }: { works: WorkData[] }) {
  const openWork = usePortal((s) => s.openWork);
  const [idx, setIdx] = useState(0);
  const hero = useMemo(() => works.filter((w) => w.banner).slice(0, HERO_COUNT), [works]);

  useEffect(() => {
    if (hero.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % hero.length), 7000);
    return () => clearInterval(t);
  }, [hero.length]);

  if (hero.length === 0) return null;
  const w = hero[idx % hero.length];

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/8" aria-label="Destaques">
      <div className="relative h-[380px] sm:h-[440px] md:h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={w.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0"
          >
            <img src={w.banner ?? w.cover} alt={`Arte de ${w.title}`} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#07070d] via-[#07070dcc]/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07070d]/80 via-transparent to-transparent" />
          </motion.div>
        </AnimatePresence>

        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8 md:p-10">
          <motion.div key={`info-${w.id}`} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <TypeBadge type={w.type} />
              <ScoreBadge score={w.avgScore} />
              <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/80">
                <Users className="h-3 w-3" /> {fmtNum(w.popularity)} leitores
              </span>
              {w.startDate && (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[11px] text-white/80">
                  <CalendarDays className="h-3 w-3" /> {w.startDate.slice(0, 4)}
                </span>
              )}
            </div>
            <h1 className="max-w-2xl text-2xl font-black leading-tight tracking-tight sm:text-4xl md:text-5xl">
              {w.title}
            </h1>
            <p className="mt-2 line-clamp-2 max-w-xl text-sm text-white/75 sm:text-[15px]">
              {w.synopsis ?? "Uma das obras mais marcantes do catálogo."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => openWork(w.id)}
                className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110"
              >
                Ver detalhes completos
              </button>
              <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 backdrop-blur">
                {w.genres.slice(0, 3).map((g) => (
                  <span key={g} className="text-[11px] font-medium text-white/70">{g}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 gap-2 sm:flex sm:flex-col">
          {hero.map((h, i) => (
            <button
              key={h.id}
              onClick={() => setIdx(i)}
              aria-label={`Destaque ${i + 1}: ${h.title}`}
              className={`h-1.5 rounded-full transition-all ${i === idx % hero.length ? "w-7 bg-primary" : "w-3 bg-white/30 hover:bg-white/50"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function CategoryChips() {
  const openExplore = usePortal((s) => s.openExplore);
  const cats: { type: WorkType; icon: React.ReactNode; desc: string }[] = [
    { type: "manga", icon: <BookOpen className="h-4 w-4" />, desc: "clássicos e novos do Japão" },
    { type: "manhwa", icon: <Layers className="h-4 w-4" />, desc: "webtoons coreanos em vertical" },
    { type: "lightnovel", icon: <Sparkles className="h-4 w-4" />, desc: "a origem literária dos isekais" },
    { type: "anime", icon: <MonitorPlay className="h-4 w-4" />, desc: "da temporada e eternos" },
  ];
  return (
    <section className="fade-up">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cats.map((c) => (
          <button
            key={c.type}
            onClick={() => openExplore({ type: c.type, genre: "all", tag: "all" })}
            className="card-hover group flex items-center gap-3 rounded-xl border border-white/8 bg-card/70 p-4 text-left"
          >
            <span className="bg-brand-gradient flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-lg shadow-violet-950/40">
              {c.icon}
            </span>
            <span>
              <span className="block text-sm font-bold">{TYPE_LABEL[c.type]}</span>
              <span className="block text-[11px] text-muted-foreground">{c.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function AiBanner() {
  const go = usePortal((s) => s.go);
  return (
    <section className="fade-up relative overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-r from-violet-950/60 via-fuchsia-950/30 to-transparent p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-10 -top-14 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-violet-200">
            <Sparkles className="h-3 w-3" /> Inteligência artificial
          </p>
          <h3 className="text-xl font-extrabold sm:text-2xl">Já viu tudo e acha tudo saturado?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Converse com a <b className="text-foreground">Aoi</b>, a curadora IA: diga seu clima, gostos e nível de picância — ela cruza tags, notas e parecidas pra achar o que você nunca viu.
          </p>
        </div>
        <button
          onClick={() => go("assistant")}
          className="bg-brand-gradient shrink-0 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110"
        >
          Pedir recomendação ✨
        </button>
      </div>
    </section>
  );
}

export function HomeView({ all, loading }: { all: WorkData[] | null; loading: boolean }) {
  const openExplore = usePortal((s) => s.openExplore);

  const sections = useMemo(() => {
    if (!all) return null;
    const byPop = [...all].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
    const byFav = [...all].sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0));
    const byScore = [...all].sort((a, b) => (b.avgScore ?? 0) - (a.avgScore ?? 0));
    const recent = all
      .filter((w) => w.startDate && w.startDate >= "2024-06")
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""));
    return {
      hero: byPop,
      trending: byPop.slice(0, 22),
      recent: recent.slice(0, 20),
      manhwa: all.filter((w) => w.type === "manhwa").sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 20),
      spicy: all.filter((w) => w.tags.some((t) => t.name === "Nudity")).sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)).slice(0, 20),
      ln: all.filter((w) => w.type === "lightnovel").sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0)).slice(0, 18),
      anime: all.filter((w) => w.type === "anime").sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 20),
      masterpieces: byScore.filter((w) => (w.avgScore ?? 0) >= 82).slice(0, 20),
    };
  }, [all]);

  return (
    <div className="space-y-9">
      {loading || !sections ? (
        <div className="shimmer h-[380px] rounded-2xl sm:h-[460px] md:h-[500px]" />
      ) : (
        <Hero works={sections.hero} />
      )}

      <CategoryChips />

      {loading || !sections ? (
        <div className="space-y-10">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="shimmer h-6 w-56 rounded" />
              <div className="flex gap-3 overflow-hidden">
                {Array.from({ length: 7 }).map((_, j) => (
                  <div key={j} className="shimmer aspect-[2/3] w-[132px] shrink-0 rounded-xl sm:w-[152px]" />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <WorkRow id="row-trending" title="Em alta agora" subtitle="o que a comunidade inteira está lendo e assistindo" works={sections.trending} />
          <AiBanner />
          {sections.recent.length > 0 && (
            <WorkRow id="row-recent" title="Lançamentos recentes" subtitle="obras novas (2024+) que estão bombando" works={sections.recent} />
          )}
          <WorkRow id="row-manhwa" title="Manhwas em ascensão" subtitle="vertical, colorido e viciante — o jeito coreano" works={sections.manhwa} />
          <div className="grid gap-9 lg:grid-cols-2">
            <WorkRow id="row-spicy" title="🔥 Sensorial em alta" subtitle="ecchi & fanservice de qualidade, escolhidos por favoritos" works={sections.spicy} />
            <WorkRow id="row-ln" title="Light novels imperdíveis" subtitle="as fontes literárias dos seus animes favoritos" works={sections.ln} />
          </div>
          <WorkRow id="row-anime" title="Animes em alta" subtitle="da temporada e clássicos eternos" works={sections.anime} />
          <WorkRow id="row-master" title="Obras-primas (nota 82+)" subtitle="o pódio absoluto de avaliação" works={sections.masterpieces} />

          <section className="fade-up rounded-2xl border border-white/8 bg-card/60 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-extrabold">Quer filtrar por gênero ou tag?</h3>
                <p className="text-sm text-muted-foreground">
                  Ação, Romance, Psicológico, Isekai, Gore, Yuri... monte sua busca no Explorar com dezenas de tags reais.
                </p>
              </div>
              <button
                onClick={() => openExplore({})}
                className="rounded-xl border border-primary/40 bg-primary/10 px-5 py-2.5 text-sm font-bold text-violet-200 transition hover:bg-primary/20"
              >
                Abrir explorador completo
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
