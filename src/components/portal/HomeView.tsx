"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Star, Sparkles, Trophy, Rocket, CalendarDays, Newspaper, Gauge, Layers, BookOpen, Clock, TrendingUp, BookMarked, Check } from "lucide-react";
import { usePortal, HYPE_MODES } from "./store";
import { CardRow, WorkCard, CardSkeleton } from "./WorkCard";
import { fetchJSON } from "@/lib/fetchClient";
import type { WorkData } from "@/lib/types";

interface NewsItem {
  id: string; kind: string; title: string; summary: string; body?: string;
  image: string | null; date: string; workId: string | null; badge: string; source?: string;
}

interface ChapterRelease {
  work: WorkData;
  nextChapter: number | null;
  dateISO: string;
  weekday: string;
  stale: boolean;
}

interface SaleItem {
  series: string;
  volume?: number;
  year: number;
  copies: number;
  note?: string;
  workId: string;
  cover: string;
  coverColor?: string | null;
  title: string;
  type: string;
}

interface MagEntry {
  name: string;
  publisher: string | null;
  demographic: string | null;
  schedule: string | null;
  count: number;
  covers: { id: string; title: string; cover: string; coverColor: string | null }[];
}

function fmtCopies(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " mi";
  if (n >= 1000) return Math.round(n / 1000) + " mil";
  return String(n);
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
  const [items, setItems] = useState<WorkData[] | null>(null);
  const [fetchedMode, setFetchedMode] = useState<string>(hypeMode);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    // hidratação instantânea: o modo já visitado abre SEM esperar a rede (defer 1 tick p/ set-state-in-effect)
    const hydrateTimer = setTimeout(() => {
      const cachedItems = readHypeCache(hypeMode);
      if (alive && cachedItems) {
        setItems(cachedItems);
        setFetchedMode(hypeMode);
      }
    }, 0);
    fetchJSON(`/api/hype?mode=${hypeMode}`).then((d) => {
      if (alive && d?.ok && Array.isArray(d.items) && d.items.length) {
        setItems(d.items);
        setFetchedMode(hypeMode);
        writeHypeCache(hypeMode, d.items);
      }
    });
    return () => { alive = false; clearTimeout(hydrateTimer); };
  }, [hypeMode]);

  useEffect(() => {
    if (!items || items.length < 2 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items, paused]);

  const mode = HYPE_MODES.find((m) => m.id === hypeMode) ?? HYPE_MODES[0];
  const w = items && fetchedMode === hypeMode ? items[idx] : undefined;

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
            <button onClick={() => openWork(w.id)} className="hidden w-36 shrink-0 overflow-hidden rounded-2xl shadow-2xl transition hover:scale-[1.03] sm:block md:w-44">
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
                  onClick={() => openWork(w.id)}
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
            onClick={() => n.workId && openWork(n.workId)}
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
              {n.source && <p className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">fonte: {n.source}</p>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Capítulos da semana — grade compacta por dia (estimativa semanal de séries ativas) */
function ChapterWeekStrip({ releases }: { releases: ChapterRelease[] }) {
  const openWork = usePortal((s) => s.openWork);
  const go = usePortal((s) => s.go);
  const today = new Date().getDay();
  const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const byDay: ChapterRelease[][] = Array.from({ length: 7 }, () => []);
  for (const r of releases) {
    const d = new Date(r.dateISO + "T12:00:00").getDay();
    byDay[d].push(r);
  }
  if (!releases.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {byDay.map((items, day) => (
        <div key={day} className={`rounded-2xl border p-2.5 ${day === today ? "border-primary/50 bg-primary/5" : "border-border bg-card"}`}>
          <p className={`mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-wider ${day === today ? "text-primary" : "text-muted-foreground"}`}>
            {WD[day]}
            {day === today && <span className="rounded bg-primary px-1 py-px text-[8px] text-white">hoje</span>}
          </p>
          <div className="flex flex-col gap-1">
            {items.length === 0 && <p className="py-1.5 text-[10px] text-muted-foreground">—</p>}
            {items.slice(0, 4).map((r) => (
              <button key={r.work.id} onClick={() => openWork(r.work.id)} className="flex items-center gap-1.5 rounded-lg bg-secondary/70 px-1.5 py-1.5 text-left transition hover:bg-accent">
                <div className="h-9 w-7 shrink-0 overflow-hidden rounded" style={{ background: r.work.coverColor ? `${r.work.coverColor}33` : "var(--muted)", minWidth: "1.75rem" }}>
                  {r.work.cover && (
                    <img src={`/api/img?u=${encodeURIComponent(r.work.cover)}`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold leading-tight">{r.work.title}</p>
                  <p className="flex items-center gap-0.5 text-[9px] font-bold text-primary">
                    <Check className="h-2 w-2" /> {r.nextChapter ? `cap ${r.nextChapter}` : "novo cap"}{r.stale ? " (ritmo estimado)" : ""}
                  </p>
                </div>
              </button>
            ))}
            {items.length > 4 && (
              <button onClick={() => go("calendar")} className="pt-0.5 text-[9px] font-bold text-primary hover:underline">
                +{items.length - 4} neste dia
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Linha de revistas — cards com faixa de capas reais */
function MagazineRow({ magazines }: { magazines: MagEntry[] }) {
  const openExplore = usePortal((s) => s.openExplore);
  const go = usePortal((s) => s.go);
  if (!magazines.length) return null;
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto pb-2">
      {magazines.slice(0, 14).map((m) => (
        <button
          key={m.name}
          onClick={() => openExplore({ mag: m.name, q: "" })}
          className="group w-56 shrink-0 rounded-2xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
          title={`${m.name} · ${m.count} obras`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-black">{m.name}</p>
            <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-black text-primary">{m.count}</span>
          </div>
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{m.publisher ?? "revista"}{m.schedule ? ` · ${m.schedule}` : ""}</p>
          <div className="mt-2 flex">
            {m.covers.slice(0, 3).map((c, i) => (
              <div
                key={c.id}
                className="h-16 w-11 overflow-hidden rounded-md border border-border"
                style={{ background: c.coverColor ? `${c.coverColor}33` : "var(--muted)", marginLeft: i > 0 ? "-14px" : undefined, zIndex: 10 - i, position: "relative" }}
              >
                <img src={`/api/img?u=${encodeURIComponent(c.cover)}`} alt={c.title} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <span className="mt-2 flex items-center gap-0.5 text-[10px] font-bold text-primary">ver obras <ChevronRight className="h-3 w-3 transition group-hover:translate-x-0.5" /></span>
        </button>
      ))}
      <button
        onClick={() => go("magazines")}
        className="flex w-36 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 text-sm font-bold text-muted-foreground transition hover:border-primary/40 hover:text-primary"
      >
        <BookMarked className="h-5 w-5" /> ver todas as revistas
      </button>
    </div>
  );
}

const SECTIONS_CACHE_KEY = "ov-sections-v2";
const SECTIONS_CACHE_TTL = 30 * 60_000;
// carrossel Hype também hidrata instantâneo — era a última seção "oco" ao reabrir o site
const HYPE_CACHE_PREFIX = "ov-hype-v1-";
const HYPE_CACHE_TTL = 30 * 60_000;

function readHypeCache(mode: string): WorkData[] | null {
  try {
    const raw = sessionStorage.getItem(HYPE_CACHE_PREFIX + mode);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c?.at && Date.now() - c.at < HYPE_CACHE_TTL && Array.isArray(c.items) && c.items.length) return c.items;
  } catch {}
  return null;
}

function writeHypeCache(mode: string, items: WorkData[]) {
  try { sessionStorage.setItem(HYPE_CACHE_PREFIX + mode, JSON.stringify({ at: Date.now(), items })); } catch {}
}

export function HomeView() {
  const [data, setData] = useState<{
    launches: WorkData[]; newMangas: WorkData[]; hits: WorkData[]; bestsellers: WorkData[]; masterpieces: WorkData[];
    ecchiHits: WorkData[]; manhwaHits: WorkData[]; animePicks: WorkData[];
    monthLaunches: WorkData[]; news: NewsItem[]; counts: { total: number };
    chapterReleases: ChapterRelease[];
  } | null>(null);
  const [sales, setSales] = useState<{ volumes: SaleItem[]; series: SaleItem[] } | null>(null);
  const [mags, setMags] = useState<{ magazines: MagEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const openExplore = usePortal((s) => s.openExplore);
  const go = usePortal((s) => s.go);
  const openWork = usePortal((s) => s.openWork);
  const user = usePortal((s) => s.user);

  useEffect(() => {
    let alive = true;
    let hydrated = false;

    const hydrateTimer = setTimeout(() => {
      // hidratação instantânea do último feed conhecido (reabrir o site = home imediata, sem loading)
      try {
        const raw = sessionStorage.getItem(SECTIONS_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.at && Date.now() - cached.at < SECTIONS_CACHE_TTL && cached?.data?.ok) {
            setData(cached.data);
            setLoading(false);
            hydrated = true;
          }
        }
      } catch {}
    }, 0);

    async function loadSections() {
      const d = await fetchJSON("/api/sections");
      if (!alive) return;
      if (d?.ok) {
        setData(d);
        setFailed(false);
        try { sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), data: d })); } catch {}
      } else if (!hydrated) {
        // só marca falha se NEM cache havia — home nunca fica oca em silêncio
        setFailed(true);
      }
      setLoading(false);
    }
    loadSections();

    fetchJSON("/api/sales").then((d) => { if (alive && d?.ok) setSales(d); });
    fetchJSON("/api/magazines").then((d) => { if (alive && d?.ok) setMags(d); });

    return () => {
      alive = false;
      clearTimeout(hydrateTimer);
    };
  }, [attempt]);

  function retry() {
    setFailed(false);
    setLoading(true);
    setAttempt((a) => a + 1);
  }

  const catChips = [
    { label: "Mangás", type: "manga", emoji: "📖" },
    { label: "Manhwas", type: "manhwa", emoji: "🇰🇷" },
    { label: "Manhuas", type: "manhua", emoji: "🇨🇳" },
    { label: "Light Novels", type: "lightnovel", emoji: "📚" },
    { label: "Animes", type: "anime", emoji: "🎬" },
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

      {loading && !data && (
        <div aria-hidden>
          <div className="skel mb-6 h-24 rounded-2xl" />
          <div className="no-scrollbar flex gap-3 overflow-hidden pb-2">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="w-[150px] shrink-0 sm:w-[168px]"><CardSkeleton /></div>
            ))}
          </div>
        </div>
      )}

      {failed && (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <p className="text-sm font-bold">Não conseguimos carregar o catálogo agora</p>
            <p className="mt-0.5 text-xs text-muted-foreground">A rede ou o servidor pisou — suas configurações estão intactas. Tente de novo em instantes.</p>
          </div>
          <button onClick={retry} className="bg-brand-gradient rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110">
            Tentar novamente
          </button>
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

          {data.newMangas?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Sparkles className="h-4 w-4" />} title="Mangás Novos — Acabaram de Chegar" sub="Começaram a publicar agora: seja o primeiro a acompanhar desde o capítulo 1" action={
                <button onClick={() => openExplore({ sort: "new", type: "manga", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver todos <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <CardRow items={data.newMangas} />
            </section>
          )}

          {data.chapterReleases?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Clock className="h-4 w-4" />} title="Lançamentos de Capítulos" sub="Próximos capítulos das séries que você acompanha — estimativa semanal das séries ativas" action={
                <button onClick={() => go("calendar")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">calendário completo <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <ChapterWeekStrip releases={data.chapterReleases} />
            </section>
          )}

          {sales && sales.volumes.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<Layers className="h-4 w-4" />} title="Vendas: Volumes Mais Vendidos" sub="Rankings reais da Oricon — os volumes individuais campeões de cada ano" action={
                <button onClick={() => go("sales")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ranking completo <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <div className="no-scrollbar flex snap-x gap-3 overflow-x-auto px-1 pb-2">
                {sales.volumes.slice(0, 14).map((v, i) => {
                  return (
                    <button
                      key={`${v.series}-${v.volume}-${v.year}`}
                      onClick={() => openWork(v.workId)}
                      className="cv-auto group relative w-[150px] shrink-0 snap-start overflow-hidden rounded-2xl border border-border bg-card text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:w-[168px]"
                    >
                      <div className="relative aspect-[2/3] w-full overflow-hidden" style={{ background: v.coverColor ? `${v.coverColor}22` : "var(--muted)" }}>
                        <img
                          src={`/api/img?u=${encodeURIComponent(v.cover)}`}
                          alt={`Capa de ${v.title}`}
                          loading="lazy"
                          decoding="async"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                        />
                        <span className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-xs font-black text-white backdrop-blur">{i + 1}</span>
                        <div className="absolute inset-x-0 bottom-0 flex bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-6">
                          <span className="bg-brand-gradient rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase text-white">Vol. {v.volume}</span>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="line-clamp-2 min-h-[2.4rem] text-[13px] font-bold leading-snug">{v.title}</p>
                        <p className="mt-1 text-[10px] font-bold text-primary">{fmtCopies(v.copies)} cópias · {v.year}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {sales && sales.series.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<TrendingUp className="h-4 w-4" />} title="Séries Mais Vendidas do Ano" sub="O que o Japão inteiro comprou — por ano, direto dos relatórios públicos da Oricon" action={
                <button onClick={() => go("sales")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver por ano <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                {sales.series.slice(0, 8).map((s, i) => (
                  <button key={`${s.series}-${s.year}`} onClick={() => openWork(s.workId)} className="group flex w-full items-center gap-3 border-b border-border p-2.5 text-left transition last:border-b-0 hover:bg-accent/60">
                    <span className={`flex h-7 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-secondary text-muted-foreground"}`}>{i + 1}</span>
                    <div className="h-12 w-9 shrink-0 overflow-hidden rounded-md" style={{ background: s.coverColor ? `${s.coverColor}33` : "var(--muted)" }}>
                      <img src={`/api/img?u=${encodeURIComponent(s.cover)}`} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold">{s.title}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtCopies(s.copies)} de cópias em {s.year}</p>
                    </div>
                    <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {mags && mags.magazines?.length > 0 && (
            <section className="cv-auto">
              <SectionHeader icon={<BookMarked className="h-4 w-4" />} title="Revistas & Editoras" sub="Onde cada obra é publicada de verdade — Weekly Shōnen Jump, Young Animal e mais" action={
                <button onClick={() => go("magazines")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">todas as revistas <ChevronRight className="h-3.5 w-3.5" /></button>
              } />
              <MagazineRow magazines={mags.magazines} />
            </section>
          )}

          <section className="cv-auto">
            <SectionHeader icon={<Flame className="h-4 w-4" />} title="Bombando: Novos Hits" sub="Em andamento, poucos capítulos publicados e já febre entre os leitores" action={
              <button onClick={() => openExplore({ sort: "new", status: "RELEASING", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">explorar <ChevronRight className="h-3.5 w-3.5" /></button>
            } />
            <CardRow items={data.hits} />
          </section>

          <section className="cv-auto">
            <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Top Popularidade" sub="As obras mais favoritadas de todos os tempos" action={
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
