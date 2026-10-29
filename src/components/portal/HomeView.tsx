"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Star, Sparkles, Trophy, Rocket, CalendarDays, Gauge } from "lucide-react";
import { usePortal, HYPE_MODES } from "./store";
import { CardRow, WorkCard, CardSkeleton } from "./WorkCard";
import AdSlot from "./AdSlot";
import { fetchJSON } from "@/lib/fetchClient";
import type { WorkData } from "@/lib/types";

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

const SECTIONS_CACHE_KEY = "ov-sections-v4"; // v4: { core, more } — home enxuta (vendas/revistas viraram views)
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
  // CARREGAMENTO EM FASES — a home não baixa tudo de uma vez:
  //   Fase 1 (imediata):   /api/sections?part=core → Notícias + Lançamentos + Mangás Novos + Capítulos
  //   Fase 2 (sob demanda): /api/sections?part=more + /api/sales + /api/magazines — disparadas quando
  //     o usuário rola até a sentinela (IntersectionObserver) ou após alguns segundos de folga.
  // Reabrir o site hidrata TODAS as fases do sessionStorage na hora (sem loading).
  interface CoreData {
    launches: WorkData[];
    counts: { total: number };
  }
  interface MoreData {
    hits: WorkData[];
    bestsellers: WorkData[];
    monthLaunches: WorkData[];
  }
  const [core, setCore] = useState<CoreData | null>(null);
  const [more, setMore] = useState<MoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const moreRequested = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const openExplore = usePortal((s) => s.openExplore);
  const go = usePortal((s) => s.go);
  const user = usePortal((s) => s.user);

  // Dedup global da home: nenhuma obra aparece em duas seções (prioridade: Lançamentos →
  // Bombando → Top → Agenda). Revisão apontou repetição entre carrosséis (ex.: Bombando × Manhwas).
  const seenLaunch = useMemo(() => new Set((core?.launches ?? []).map((w) => w.id)), [core]);
  const hits = useMemo(() => (more?.hits ?? []).filter((w) => !seenLaunch.has(w.id)), [more, seenLaunch]);
  const seenHits = useMemo(() => new Set([...seenLaunch, ...hits.map((w) => w.id)]), [seenLaunch, hits]);
  const bestsellers = useMemo(() => (more?.bestsellers ?? []).filter((w) => !seenHits.has(w.id)), [more, seenHits]);
  const monthLaunches = useMemo(
    () => (more?.monthLaunches ?? []).filter((w) => !seenHits.has(w.id) && !bestsellers.some((b) => b.id === w.id)),
    [more, seenHits, bestsellers]
  );

  // FASE 2 — uma única vez por montagem (single-flight via ref)
  const loadMorePhase = useCallback(() => {
    if (moreRequested.current) return;
    moreRequested.current = true;
    fetchJSON("/api/sections?part=more").then((d) => {
      if (d?.ok) setMore({ hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], monthLaunches: d.monthLaunches ?? [] });
    });
  }, []);

  useEffect(() => {
    let alive = true;
    let hydrated = false;

    const hydrateTimer = setTimeout(() => {
      // hidratação instantânea: as DUAS fases abrem juntas do cache (reabrir o site = home imediata)
      try {
        const raw = sessionStorage.getItem(SECTIONS_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw);
          if (cached?.at && Date.now() - cached.at < SECTIONS_CACHE_TTL && cached?.core) {
            setCore(cached.core);
            if (cached.more) setMore(cached.more);
            setLoading(false);
            hydrated = true;
          }
        }
      } catch {}
    }, 0);

    // FASE 1 — o essencial da primeira dobra
    async function loadCore() {
      const d = await fetchJSON("/api/sections?part=core");
      if (!alive) return;
      if (d?.ok) {
        const c: CoreData = { launches: d.launches ?? [], counts: d.counts ?? { total: 0 } };
        setCore(c);
        setFailed(false);
        // guarda na sessão preservando as fases que já chegaram
        try {
          const prev = JSON.parse(sessionStorage.getItem(SECTIONS_CACHE_KEY) ?? "{}");
          sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: c, more: prev.more }));
        } catch {}
      } else if (!hydrated) {
        // só marca falha se NEM cache havia — home nunca fica oca em silêncio
        setFailed(true);
      }
      setLoading(false);
    }
    loadCore();

    // reabertura com cache: revalida a fase 2 em background após 2,5s (sem piscar nada)
    const idleTimer = setTimeout(() => {
      if (hydrated) {
        fetchJSON("/api/sections?part=more").then((d) => {
          if (alive && d?.ok) setMore({ hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], monthLaunches: d.monthLaunches ?? [] });
        });
      }
    }, 2_500);

    return () => {
      alive = false;
      clearTimeout(hydrateTimer);
      clearTimeout(idleTimer);
    };
  }, [attempt]);

  // Sentinela: o fim da fase 1 entrando na tela pede a fase 2 ao servidor.
  // Sem IntersectionObserver (ou tela muito alta): fallback por tempo ocioso.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const t = setTimeout(loadMorePhase, 3_500);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMorePhase();
      },
      { rootMargin: "600px 0px" } // começa a buscar ANTES de o usuário ver o fim
    );
    io.observe(el);
    const t = setTimeout(loadMorePhase, 6_000); // rede de segurança (cache hidratado, tela alta…)
    return () => { io.disconnect(); clearTimeout(t); };
  }, [loadMorePhase]);

  // fase 2 ainda não veio (rede caiu) → tenta de novo quando a conexão voltar
  useEffect(() => {
    if (more) return;
    const on = () => loadMorePhase();
    window.addEventListener("online", on);
    return () => window.removeEventListener("online", on);
  }, [more, loadMorePhase]);

  // persiste a fase 2 no cache da sessão assim que chega
  useEffect(() => {
    if (!more) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(SECTIONS_CACHE_KEY) ?? "{}");
      sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: prev.core, more }));
    } catch {}
  }, [more]);

  function retry() {
    setFailed(false);
    setLoading(true);
    setAttempt((a) => a + 1);
  }

  // auto-recuperação da home: se falhou (servidor fora do ar), tenta de novo sozinho
  // em 10s e quando o navegador anunciar reconexão — nunca fica morta esperando clique.
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setAttempt((a) => a + 1), 10_000);
    const on = () => setAttempt((a) => a + 1);
    window.addEventListener("online", on);
    return () => {
      clearTimeout(t);
      window.removeEventListener("online", on);
    };
  }, [failed]);

  const catChips = [
    { label: "Mangás", type: "manga", emoji: "📖" },
    { label: "Manhwas", type: "manhwa", emoji: "🇰🇷" },
    { label: "Manhuas", type: "manhua", emoji: "🇨🇳" },
    { label: "Light Novels", type: "lightnovel", emoji: "📚" },
    { label: "Webnovels", type: "webnovel", emoji: "🌐" },
    { label: "Animes", type: "anime", emoji: "🎬" },
    { label: "Ecchi", type: "all", classification: "suggestive", emoji: "🔥" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <HypeCarousel />

      {/* Aoi — entrada principal da home */}
      <section className="relative overflow-hidden rounded-3xl bg-hero-grad p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <span className="waifu-avatar flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-3xl backdrop-blur">🌸</span>
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/70">Sua waifu curadora</p>
            <h3 className="text-xl font-black sm:text-2xl">Aoi-chan te ajuda a achar a próxima obsessão</h3>
            <p className="mt-1 max-w-xl text-sm text-white/80">
              Diga o que você sente namorar: "quero ecchi com boa história", "me dá manhwa de vingança" — ela garimpa o catálogo e responde com carinho. {user ? "Você já tem a Aoi disponível no menu!" : "Sem cadastro também funciona."}
            </p>
          </div>
          <button onClick={() => go("assistant")} className="bg-white px-5 py-2.5 text-sm font-black text-slate-900 shadow-xl transition hover:scale-105">
            Falar com a Aoi
          </button>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-32 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
      </section>

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

      {loading && !core && (
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

      {core && (
        <>
          <section className="cv-auto">
            <SectionHeader icon={<Rocket className="h-4 w-4" />} title="Lançamentos Recentes" sub="Estreias fresquinhas dos últimos 90 dias" action={
              <button onClick={() => openExplore({ sort: "new", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ver todos <ChevronRight className="h-3.5 w-3.5" /></button>
            } />
            <CardRow items={core.launches} />
          </section>

          {/* anúncio SÓ renderiza em contexto safe com AdSense configurado (ver AdSlot) */}
          <AdSlot slotId="home-mid" />

          {more && (
            <>
              <section className="cv-auto">
                <SectionHeader icon={<Flame className="h-4 w-4" />} title="Bombando: Novos Hits" sub="Em andamento, poucos capítulos publicados e já febre entre os leitores" action={
                  <button onClick={() => openExplore({ sort: "new", status: "RELEASING", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">explorar <ChevronRight className="h-3.5 w-3.5" /></button>
                } />
                <CardRow items={hits} />
              </section>

              <section className="cv-auto">
                <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Top Popularidade" sub="As obras mais favoritadas da comunidade" action={
                  <button onClick={() => openExplore({ sort: "favorites", q: "" })} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">ranking completo <ChevronRight className="h-3.5 w-3.5" /></button>
                } />
                <CardRow items={bestsellers} ranks />
              </section>

              {monthLaunches.length > 0 && (
                <section className="cv-auto">
                  <SectionHeader icon={<CalendarDays className="h-4 w-4" />} title="Agenda do Mês" sub="Estreias e retornos previstos — datas estimadas, confirme no calendário" action={
                    <button onClick={() => go("calendar")} className="flex items-center gap-1 text-xs font-bold text-primary hover:underline">abrir calendário <ChevronRight className="h-3.5 w-3.5" /></button>
                  } />
                  <CardRow items={monthLaunches} />
                </section>
              )}
            </>
          )}

          {/* stats do catálogo */}
          <p className="flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            Catálogo com {core.counts.total.toLocaleString("pt-BR")} obras · atualização automática a cada 30 min · mais opções em Explorar
          </p>
        </>
      )}
    </div>
  );
}
