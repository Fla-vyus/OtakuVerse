"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Star, Sparkles, Trophy, Rocket, CalendarDays, Newspaper, Gauge, ListFilter } from "lucide-react";
import { usePortal, HYPE_MODES } from "./store";
import { CardRow, WorkCard } from "./WorkCard";
import type { WorkData } from "@/lib/types";

interface NewsItem {
  id: string; kind: string; title: string; summary: string;
  image: string | null; date: string; workId: string; badge: string;
}

function SectionHeader({ icon, title, sub, action }: { icon: React.ReactNode; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-black tracking-tight sm:text-xl">
          <span className="bg-brand-gradient flex h-7 w-7 items-center justify-center rounded-lg text-white">{icon}</span>
          {title}
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </div>
      {action}
    </div>
  );
}

/** Carrossel Hype — os melhores do momento, com modos trocáveis */
function HypeCarousel() {
  const hypeMode = usePortal((s) => s.hypeMode);
  const setHypeMode = usePortal((s) => s.setHypeMode);
  const openWork = usePortal((s) => s.openWork);
  const openWorkRef = useRef(openWork);
  openWorkRef.current = openWork;
  const [items, setItems] = useState<WorkData[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    setItems(null);
    fetch(`/api/hype?mode=${hypeMode}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setItems(d.items);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [hypeMode]);

  useEffect(() => {
    if (!items || items.length < 2 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items, paused]);

  const mode = HYPE_MODES.find((m) => m.id === hypeMode) ?? HYPE_MODES[0];
  const w = items?.[idx];

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Destaques"
    >
      {/* fundo */}
      {w?.banner || w?.cover ? (
        <img
          src={`/api/img?u=${encodeURIComponent(w.banner ?? w.cover!)}`}
          alt=""
          referrerPolicy="no-referrer"
          className="kenburns absolute inset-0 h-full w-full object-cover"
          key={w.id + idx}
        />
      ) : (
        <div className="absolute inset-0 bg-hero-grad" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20" />

      <div className="relative z-10 p-4 pb-6 sm:p-6">
        {/* seletor de modo */}
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          {HYPE_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setHypeMode(m.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold backdrop-blur transition ${
                hypeMode === m.id ? "bg-white text-slate-900 shadow-lg" : "bg-white/15 text-white hover:bg-white/25"
              }`}
              title={m.desc}
            >
              {m.id === "hype" && <Flame className="h-3.5 w-3.5" />}
              {m.id === "score" && <Star className="h-3.5 w-3.5" />}
              {m.id === "new" && <Rocket className="h-3.5 w-3.5" />}
              {m.id === "classic" && <Trophy className="h-3.5 w-3.5" />}
              {m.name}
            </button>
          ))}
        </div>

        {w ? (
          <div className="fade-up flex items-center gap-4 sm:gap-6" key={w.id}>
            <button onClick={() => openWorkRef.current(w.id)} className="hidden w-36 shrink-0 overflow-hidden rounded-2xl shadow-2xl transition hover:scale-[1.03] sm:block md:w-44">
              <img
                src={`/api/img?u=${encodeURIComponent(w.cover)}`}
                alt={`Capa de ${w.title}`}
                referrerPolicy="no-referrer"
                loading="lazy"
                className="aspect-[2/3] w-full object-cover"
              />
            </button>
            <div className="min-w-0 flex-1 text-white">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-white/70">{mode.desc}</p>
              <h2 className="line-clamp-2 text-2xl font-black leading-tight drop-shadow sm:text-4xl">{w.title}</h2>
              <p className="mt-2 line-clamp-2 max-w-2xl text-xs text-white/80 sm:text-sm">{w.synopsis}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-md bg-white/20 px-2 py-1 font-bold backdrop-blur">⭐ {w.avgScore ?? "—"}</span>
                <span className="rounded-md bg-white/20 px-2 py-1 font-bold capitalize backdrop-blur">{w.type}</span>
                {w.genres.slice(0, 3).map((g) => (
                  <span key={g} className="rounded-md bg-white/10 px-2 py-1 backdrop-blur">{g}</span>
                ))}
                <button
                  onClick={() => openWorkRef.current(w.id)}
                  className="bg-brand-gradient ml-auto hidden rounded-xl px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 sm:block"
                >
                  Ver obra
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-48 items-center justify-center text-white/70">
            <Sparkles className="mr-2 h-5 w-5 animate-pulse" /> Buscando os melhores do momento...
          </div>
        )}

        {/* controles */}
        {items && items.length > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5">
              {items.slice(0, 8).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Destaque ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30" aria-label="Anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button onClick={() => setIdx((i) => (i + 1) % items.length)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/30" aria-label="Próximo">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function NewsTeaser({ news }: { news: NewsItem[] }) {
  const openWork = usePortal((s) => s.openWork);
  const go = usePortal((s) => s.go);
  if (!news?.length) return null;
  return (
    <section className="cv-auto">
      <SectionHeader icon={<Newspaper className="h-4 w-4" />} title="Central de Notícias" sub="O que aconteceu no mundo otaku — dados reais, atualizado o dia todo" action={
        <button onClick={() => go("news")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver tudo <ChevronRight className="h-3.5 w-3.5" /></button>
      } />
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
        {news.slice(0, 8).map((n) => (
          <button
            key={n.id}
            onClick={() => openWork(n.workId)}
            className="group w-64 shrink-0 overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="relative aspect-video w-full overflow-hidden" style={{ background: "var(--muted)" }}>
              {n.image && (
                <img
                  src={`/api/img?u=${encodeURIComponent(n.image)}`}
                  alt={n.title}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              )}
              <span className="bg-brand-gradient absolute left-2 top-2 rounded-md px-2 py-0.5 text-[10px] font-black uppercase text-white">{n.badge}</span>
            </div>
            <div className="p-3">
              <p className="line-clamp-1 text-sm font-bold">{n.title}</p>
              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{n.summary}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export function HomeView() {
  const [data, setData] = useState<{
    launches: WorkData[]; hits: WorkData[]; bestsellers: WorkData[]; masterpieces: WorkData[];
    ecchiHits: WorkData[]; manhwaHits: WorkData[]; animePicks: WorkData[]; dramaPicks: WorkData[];
    monthLaunches: WorkData[]; news: NewsItem[]; counts: { total: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const openExplore = usePortal((s) => s.openExplore);
  const go = usePortal((s) => s.go);
  const user = usePortal((s) => s.user);

  useEffect(() => {
    fetch("/api/sections")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const catChips = [
    { label: "Mangás", type: "manga", emoji: "📖" },
    { label: "Manhwas", type: "manhwa", emoji: "🇰🇷" },
    { label: "Manhuas", type: "manhua", emoji: "🇨🇳" },
    { label: "Light Novels", type: "lightnovel", emoji: "📚" },
    { label: "Animes", type: "anime", emoji: "🎬" },
    { label: "Dramas", type: "drama", emoji: "📺" },
    { label: "Ecchi", type: "all", classification: "suggestive", emoji: "🔥" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <HypeCarousel />

      {/* chips de categoria */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {catChips.map((c) => (
          <button
            key={c.label}
            onClick={() =>
              openExplore({
                type: c.type,
                ...(c.classification ? { classification: c.classification } : { classification: "all" }),
                q: "",
              })
            }
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-bold transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          >
            <span>{c.emoji}</span> {c.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
          <Sparkles className="h-5 w-5 animate-pulse text-primary" /> Carregando o catálogo real...
        </div>
      )}

      {data && (
        <>
          {data.news?.length > 0 && <NewsTeaser news={data.news} />}

          <section className="cv-auto">
            <SectionHeader icon={<Rocket className="h-4 w-4" />} title="Lançamentos Recentes" sub="Estreias fresquinhas dos últimos 90 dias" action={
              <button onClick={() => openExplore({ sort: "new", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver todos <ChevronRight className="h-3.5 w-3.5" /></button>
            } />
            <CardRow items={data.launches} />
          </section>

          <section className="cv-auto">
            <SectionHeader icon={<Flame className="h-4 w-4" />} title="Bombando: Novos Hits" sub="Em andamento, poucos capítulos publicados e já febre entre os leitores" action={
              <button onClick={() => openExplore({ sort: "new", status: "RELEASING", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">explorar <ChevronRight className="h-3.5 w-3.5" /></button>
            } />
            <CardRow items={data.hits} />
          </section>

          <section className="cv-auto">
            <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Top Popularidade (proxy de vendas)" sub="As obras mais favoritadas — o mais perto de um ranking de vendas global" action={
              <button onClick={() => openExplore({ sort: "favorites", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ranking completo <ChevronRight className="h-3.5 w-3.5" /></button>
            } />
            <CardRow items={data.bestsellers} ranks />
          </section>

          {data.masterpieces?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Star className="h-4 w-4" />} title="Obras-Primas" sub="As melhores notas de todos os tempos — patrimônio do meio" action={
                <button onClick={() => openExplore({ sort: "score", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver todas <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.masterpieces} />
            </section>
          )}

          {data.manhwaHits?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Gauge className="h-4 w-4" />} title="Manhwas em Alta" sub="Coreia dominando: os webtoons mais acompanhados" action={
                <button onClick={() => openExplore({ type: "manhwa", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">todos <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.manhwaHits} />
            </section>
          )}

          {data.ecchiHits?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Flame className="h-4 w-4" />} title="Ecchi/Sensorial em Alta" sub="Picantes de bom gosto — arte bonita e clima quente (etiquetados)" action={
                <button onClick={() => openExplore({ classification: "suggestive", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">explorar <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.ecchiHits} />
            </section>
          )}

          {data.animePicks?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Animes do Momento" sub="Os mais amados da tela para a sua telinha" action={
                <button onClick={() => openExplore({ type: "anime", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">todos <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.animePicks} />
            </section>
          )}

          {data.dramaPicks?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Star className="h-4 w-4" />} title="Dramas em Destaque" sub="K-dramas, C-dramas, J-dramas e tailandeses imperdíveis" action={
                <button onClick={() => openExplore({ type: "drama", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">todos <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.dramaPicks} />
            </section>
          )}

          {data.monthLaunches.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title="Agenda do Mês" sub="Estreias e retornos programados para este mês" action={
                <button onClick={() => go("calendar")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">abrir calendário <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.monthLaunches} />
            </section>
          )}
        </>
      )}

      {/* banner da Aoi */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-grad p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="waifu-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur">🌸</span>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Sua waifu curadora</p>
            <h3 className="text-xl font-black sm:text-2xl">Aoi-chan te ajuda a achar a próxima obsessão</h3>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Diga o que você sente namorar: "quero ecchi com boa história", "me dá manhwa de vingança" — ela garimpa no catálogo real e responde com carinho. {user ? "Você já tem a Aoi disponível no menu!" : "Sem cadastro também funciona."}
            </p>
          </div>
          <button onClick={() => go("assistant")} className="bg-white px-5 py-2.5 text-sm font-black text-slate-900 shadow-xl transition hover:scale-105">
            Falar com a Aoi
          </button>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      </section>

      {/* stats do catálogo */}
      {data && (
        <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
          <Gauge className="h-3.5 w-3.5" />
          Catálogo com {data.counts.total.toLocaleString("pt-BR")} obras reais · atualização automática a cada 30 min · busque mais via Explorar
        </p>
      )}
    </div>
  );
}
