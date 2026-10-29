#!/usr/bin/env python3
# Cirurgia da HomeView v3.8: home enxuta (5 seções) + Aoi no topo + dedup global + fetches mortos fora.
# Cada substituição usa âncoras literais exatas; o script aborta se alguma âncora não bater (zero risco silencioso).
import sys, pathlib

P = pathlib.Path("/home/z/my-project/src/components/portal/HomeView.tsx")
src = P.read_text(encoding="utf-8")
n_fail = 0

def rep(old: str, new: str, label: str, count: int = 1):
    global src, n_fail
    found = src.count(old)
    if found != count:
        print(f"✗ FALHOU [{label}]: esperado {count}x, encontrado {found}x"); n_fail += 1; return
    src = src.replace(old, new, count)
    print(f"✓ [{label}]")

# ---- 1. imports: useMemo + icons ----
rep(
    'import { useCallback, useEffect, useRef, useState } from "react";',
    'import { useCallback, useEffect, useMemo, useRef, useState } from "react";',
    "imports react",
)
rep(
    'import { ChevronLeft, ChevronRight, Flame, Star, Sparkles, Trophy, Rocket, CalendarDays, Newspaper, Gauge, Layers, BookOpen, Clock, TrendingUp, BookMarked, Check, Globe } from "lucide-react";',
    'import { ChevronLeft, ChevronRight, Flame, Star, Sparkles, Trophy, Rocket, CalendarDays, Gauge } from "lucide-react";',
    "imports lucide",
)

# ---- 2. interfaces mortas + fmtCopies (11-51) ----
i_start = src.index("interface NewsItem {")
i_end = src.index("function SectionHeader(")
src = src[:i_start] + src[i_end:]
print("✓ [interfaces + fmtCopies fora]")

# ---- 3. componentes mortos: NewsTeaser + ChapterWeekStrip + MagazineRow ----
i_start = src.index("function NewsTeaser(")
i_end = src.index('const SECTIONS_CACHE_KEY = ')
src = src[:i_start] + src[i_end:]
print("✓ [NewsTeaser/ChapterWeekStrip/MagazineRow fora]")

# ---- 4. chave do cache v3 → v4 (invalida hidratação antiga) ----
rep(
    'const SECTIONS_CACHE_KEY = "ov-sections-v3"; // v3: { core, more, sales, mags } — fases',
    'const SECTIONS_CACHE_KEY = "ov-sections-v4"; // v4: { core, more } — home enxuta (vendas/revistas viraram views)',
    "cache key v4",
)

# ---- 5. estados enxutos + dedup ----
rep(
    """  interface CoreData {
    launches: WorkData[]; newMangas: WorkData[]; chapterReleases: ChapterRelease[];
    news: NewsItem[]; counts: { total: number };
  }
  interface MoreData {
    hits: WorkData[]; bestsellers: WorkData[]; masterpieces: WorkData[]; ecchiHits: WorkData[];
    manhwaHits: WorkData[]; animePicks: WorkData[]; monthLaunches: WorkData[]; webnovelPicks: WorkData[];
  }
  const [core, setCore] = useState<CoreData | null>(null);
  const [more, setMore] = useState<MoreData | null>(null);
  const [sales, setSales] = useState<{ volumes: SaleItem[]; series: SaleItem[] } | null>(null);
  const [mags, setMags] = useState<{ magazines: MagEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const moreRequested = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const openExplore = usePortal((s) => s.openExplore);
  const go = usePortal((s) => s.go);
  const openWork = usePortal((s) => s.openWork);
  const user = usePortal((s) => s.user);""",
    """  interface CoreData {
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
  );""",
    "estados + dedup",
)

# ---- 6. loadMorePhase sem vendas/revistas ----
rep(
    """  // FASE 2 — uma única vez por montagem (single-flight via ref); vendas/revistas vão junto
  const loadMorePhase = useCallback(() => {
    if (moreRequested.current) return;
    moreRequested.current = true;
    fetchJSON("/api/sections?part=more").then((d) => {
      if (d?.ok) {
        setMore({
          hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], masterpieces: d.masterpieces ?? [],
          ecchiHits: d.ecchiHits ?? [], manhwaHits: d.manhwaHits ?? [], animePicks: d.animePicks ?? [],
          monthLaunches: d.monthLaunches ?? [], webnovelPicks: d.webnovelPicks ?? [],
        });
      }
    });
    fetchJSON("/api/sales").then((d) => { if (d?.ok) setSales(d); });
    fetchJSON("/api/magazines").then((d) => { if (d?.ok) setMags(d); });
  }, []);""",
    """  // FASE 2 — uma única vez por montagem (single-flight via ref)
  const loadMorePhase = useCallback(() => {
    if (moreRequested.current) return;
    moreRequested.current = true;
    fetchJSON("/api/sections?part=more").then((d) => {
      if (d?.ok) setMore({ hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], monthLaunches: d.monthLaunches ?? [] });
    });
  }, []);""",
    "loadMorePhase",
)

# ---- 7. revalidação idle do cache sem vendas/revistas (2ª ocorrência do setMore) ----
rep(
    """      if (hydrated) {
        fetchJSON("/api/sections?part=more").then((d) => {
          if (alive && d?.ok) {
            setMore({
              hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], masterpieces: d.masterpieces ?? [],
              ecchiHits: d.ecchiHits ?? [], manhwaHits: d.manhwaHits ?? [], animePicks: d.animePicks ?? [],
              monthLaunches: d.monthLaunches ?? [], webnovelPicks: d.webnovelPicks ?? [],
            });
          }
        });
      }""",
    """      if (hydrated) {
        fetchJSON("/api/sections?part=more").then((d) => {
          if (alive && d?.ok) setMore({ hits: d.hits ?? [], bestsellers: d.bestsellers ?? [], monthLaunches: d.monthLaunches ?? [] });
        });
      }""",
    "idle revalidate",
)

# ---- 8. hydrate sem sales/mags ----
rep(
    """            if (cached.more) setMore(cached.more);
            if (cached.sales) setSales(cached.sales);
            if (cached.mags) setMags(cached.mags);""",
    """            if (cached.more) setMore(cached.more);""",
    "hydrate",
)

# ---- 9. parse do core enxuto ----
rep(
    """        const c: CoreData = {
          launches: d.launches ?? [], newMangas: d.newMangas ?? [], chapterReleases: d.chapterReleases ?? [],
          news: d.news ?? [], counts: d.counts ?? { total: 0 },
        };""",
    """        const c: CoreData = { launches: d.launches ?? [], counts: d.counts ?? { total: 0 } };""",
    "parse core",
)

# ---- 10. persist do loadCore sem sales/mags ----
rep(
    'sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: c, more: prev.more, sales: prev.sales, mags: prev.mags }));',
    'sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: c, more: prev.more }));',
    "persist core",
)

# ---- 11. persistências pós-more (bloco duplo → simples) ----
rep(
    """  // persiste as fases no cache da sessão conforme chegam
  useEffect(() => {
    if (!more) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(SECTIONS_CACHE_KEY) ?? "{}");
      sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: prev.core, more, sales: prev.sales, mags: prev.mags }));
    } catch {}
  }, [more]);
  useEffect(() => {
    if (!sales && !mags) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(SECTIONS_CACHE_KEY) ?? "{}");
      sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: prev.core, more: prev.more, sales: sales ?? prev.sales, mags: mags ?? prev.mags }));
    } catch {}
  }, [sales, mags]);""",
    """  // persiste a fase 2 no cache da sessão assim que chega
  useEffect(() => {
    if (!more) return;
    try {
      const prev = JSON.parse(sessionStorage.getItem(SECTIONS_CACHE_KEY) ?? "{}");
      sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify({ at: Date.now(), core: prev.core, more }));
    } catch {}
  }, [more]);""",
    "persist more",
)

# ---- 12. return inteiro: home enxuta com Aoi no topo ----
r_start = src.index('  return (\n    <div className="flex flex-col gap-8">')
NEW_RETURN = '''  return (
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
'''
src = src[:r_start] + NEW_RETURN
print("✓ [return enxuto]")
print("✓ [banner Aoi movido para o topo]")

P.write_text(src, encoding="utf-8")
print(f"\n{'='*40}\nErros: {n_fail} — {'OK, arquivo salvo' if n_fail == 0 else 'CORRIGIR ANTES DE PROSSEGUIR'}")
sys.exit(1 if n_fail else 0)
