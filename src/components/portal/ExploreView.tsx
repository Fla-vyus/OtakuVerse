"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight, Compass, Lock, Flame } from "lucide-react";
import { usePortal, DEFAULT_FILTERS } from "./store";
import { CardGrid } from "./WorkCard";
import { fetchJSON } from "@/lib/fetchClient";
import { FAMOUS_TAGS } from "@/lib/tags";
import { Input } from "@/components/ui/input";
import type { WorkData } from "@/lib/types";

const TYPES = [
  { v: "all", label: "Todos" },
  { v: "manga", label: "Mangá" },
  { v: "manhwa", label: "Manhwa" },
  { v: "manhua", label: "Manhua" },
  { v: "lightnovel", label: "Light Novel" },
  { v: "anime", label: "Anime" },
];

const SORTS = [
  { v: "popular", label: "Mais populares" },
  { v: "score", label: "Melhores notas" },
  { v: "favorites", label: "Mais favoritados" },
  { v: "new", label: "Mais recentes" },
  { v: "chapters", label: "Mais capítulos" },
  { v: "title", label: "A–Z" },
];

const STATUSES = [
  { v: "all", label: "Qualquer status" },
  { v: "RELEASING", label: "Em lançamento" },
  { v: "FINISHED", label: "Concluído" },
  { v: "HIATUS", label: "Em hiato" },
  { v: "NOT_YET_RELEASED", label: "Não lançado" },
];

const LANGS = [
  { v: "all", label: "Qualquer idioma" },
  { v: "JA", label: "Japonês (original)" },
  { v: "KO", label: "Coreano (original)" },
  { v: "ZH", label: "Chinês (original)" },
  { v: "EN", label: "Inglês disponível" },
  { v: "PT-BR", label: "Português (BR)" },
];

const PER_PAGE_OPTIONS = [60, 120, 180];

export function ExploreView() {
  const filters = usePortal((s) => s.filters);
  const setFilters = usePortal((s) => s.setFilters);
  const user = usePortal((s) => s.user);
  const [items, setItems] = useState<WorkData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(60);
  const [facets, setFacets] = useState<{ genres: { name: string; count: number }[]; tags: { name: string; count: number }[]; magazines?: { name: string; count: number }[] }>({ genres: [], tags: [] });
  const [loading, setLoading] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [liveResults, setLiveResults] = useState<WorkData[] | null>(null); // busca ao vivo AniList
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const fetchPage = useCallback(
    (p: number) => {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(p),
        perPage: String(perPage),
      });
      if (filters.type !== "all") params.set("type", filters.type);
      if (filters.genre !== "all") params.set("genre", filters.genre);
      if (filters.tag !== "all") params.set("tag", filters.tag);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.sort !== "popular") params.set("sort", filters.sort);
      if (filters.classification !== "all") params.set("classification", filters.classification);
      if (filters.lang !== "all") params.set("lang", filters.lang);
      if (filters.mag !== "all") params.set("mag", filters.mag);
      if (filters.q.trim()) params.set("q", filters.q.trim());
      fetchJSON(`/api/works?${params.toString()}`)
        .then((d) => {
          if (d?.ok) {
            setItems(d.items);
            setTotal(d.total);
            if (d.facets) setFacets(d.facets);
          }
        })
        .finally(() => setLoading(false));
    },
    [filters, perPage]
  );

  // reset derivado em render — troca de filtros volta para a página 1
  const fKey = `${JSON.stringify(filters)}|${perPage}`;
  const [prevFKey, setPrevFKey] = useState(fKey);
  if (prevFKey !== fKey) {
    setPrevFKey(fKey);
    setPage(1);
  }

  useEffect(() => {
    // defer 1 tick: evita setState síncrono no corpo do effect (cascata de render)
    const t = setTimeout(() => {
      fetchPage(page);
      topRef.current?.scrollIntoView({ behavior: "instant", block: "start" });
    }, 0);
    return () => clearTimeout(t);
  }, [page, fetchPage]);

  // busca ao vivo na AniList quando há texto e poucos resultados locais
  // reset derivado em render — limpa resultados ao mudar a busca
  const q = filters.q.trim();
  const [prevQ, setPrevQ] = useState(q);
  if (prevQ !== q) {
    setPrevQ(q);
    setLiveResults(null);
  }
  useEffect(() => {
    const term = filters.q.trim();
    if (term.length < 3) return;
    debounce.current = setTimeout(() => {
      fetchJSON(`/api/discover?q=${encodeURIComponent(term)}`, { tries: 1, timeoutMs: 12000 })
        .then((d) => {
          if (d?.ok && Array.isArray(d.items) && d.items.length) setLiveResults(d.items.slice(0, 12));
        })
        .catch(() => {});
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [filters.q]);

  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.q) chips.push({ label: `"${filters.q}"`, clear: () => setFilters({ q: "" }) });
    if (filters.type !== "all") chips.push({ label: TYPES.find((t) => t.v === filters.type)?.label ?? filters.type, clear: () => setFilters({ type: "all" }) });
    if (filters.genre !== "all") chips.push({ label: filters.genre, clear: () => setFilters({ genre: "all" }) });
    if (filters.tag !== "all") chips.push({ label: FAMOUS_TAGS.find((t) => t.tag === filters.tag)?.label ?? filters.tag, clear: () => setFilters({ tag: "all" }) });
    if (filters.status !== "all") chips.push({ label: STATUSES.find((s) => s.v === filters.status)?.label ?? filters.status, clear: () => setFilters({ status: "all" }) });
    if (filters.classification !== "all") chips.push({ label: filters.classification === "suggestive" ? "Ecchi/Sensorial" : filters.classification, clear: () => setFilters({ classification: "all" }) });
    if (filters.lang !== "all") chips.push({ label: LANGS.find((l) => l.v === filters.lang)?.label ?? filters.lang, clear: () => setFilters({ lang: "all" }) });
    if (filters.mag !== "all") chips.push({ label: `revista: ${filters.mag}`, clear: () => setFilters({ mag: "all" }) });
    return chips;
  }, [filters, setFilters]);

  return (
    <div ref={topRef} className="flex flex-col gap-4">
      {/* busca + ordenação */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.q}
            onChange={(e) => setFilters({ q: e.target.value })}
            placeholder="Buscar por título, autor, nome alternativo..."
            className="pl-9"
            aria-label="Buscar"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ sort: e.target.value })}
            className="h-10 rounded-xl border border-input bg-background px-3 text-sm font-semibold"
            aria-label="Ordenar"
          >
            {SORTS.map((s) => (
              <option key={s.v} value={s.v}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowAdvanced((s) => !s)}
            className={`flex h-10 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition ${showAdvanced ? "border-primary/40 bg-primary/10 text-primary" : "border-input bg-background"}`}
          >
            <SlidersHorizontal className="h-4 w-4" /> Filtros
          </button>
        </div>
      </div>

      {/* chips de tipo rápidos */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {TYPES.map((t) => (
          <button
            key={t.v}
            onClick={() => setFilters({ type: t.v })}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-bold transition ${
              filters.type === t.v ? "bg-primary text-primary-foreground shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setFilters({ classification: filters.classification === "suggestive" ? "all" : "suggestive" })}
          className={`flex shrink-0 items-center gap-1 rounded-full px-4 py-1.5 text-sm font-bold transition ${
            filters.classification === "suggestive" ? "bg-pink-600 text-white shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
          }`}
        >
          <Flame className="h-3.5 w-3.5" /> Ecchi/Sensorial
        </button>
      </div>

      {/* tags famosas — atalhos curados para os temas mais buscados do mundo otaku */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1" aria-label="Tags famosas">
        {FAMOUS_TAGS.map((t) => {
          const active = filters.tag === t.tag;
          return (
            <button
              key={t.tag}
              onClick={() => setFilters({ tag: active ? "all" : t.tag })}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                active ? "bg-primary text-primary-foreground shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* filtros avançados */}
      {showAdvanced && (
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-bold text-muted-foreground">
            Gênero
            <select value={filters.genre} onChange={(e) => setFilters({ genre: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground">
              <option value="all">Todos os gêneros</option>
              {facets.genres.map((g) => (
                <option key={g.name} value={g.name}>{g.name} ({g.count})</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            Tag (tema)
            <select value={filters.tag} onChange={(e) => setFilters({ tag: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground">
              <option value="all">Todas as tags</option>
              {facets.tags.map((t) => (
                <option key={t.name} value={t.name}>{t.name} ({t.count})</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            Status
            <select value={filters.status} onChange={(e) => setFilters({ status: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground">
              {STATUSES.map((s) => (
                <option key={s.v} value={s.v}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            Idioma
            <select value={filters.lang} onChange={(e) => setFilters({ lang: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground">
              {LANGS.map((l) => (
                <option key={l.v} value={l.v}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-muted-foreground">
            Revista / publicação
            <select value={filters.mag} onChange={(e) => setFilters({ mag: e.target.value })} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm font-semibold text-foreground">
              <option value="all">Todas as revistas</option>
              {(facets.magazines ?? []).map((m) => (
                <option key={m.name} value={m.name}>{m.name} ({m.count})</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {/* chips ativos */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((c, i) => (
            <button key={i} onClick={c.clear} className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition hover:bg-primary/20">
              {c.label} <span className="text-[10px]">✕</span>
            </button>
          ))}
          <button onClick={() => setFilters({ ...DEFAULT_FILTERS })} className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">
            limpar tudo
          </button>
        </div>
      )}

      {/* resultados */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {loading ? "Buscando..." : `${total.toLocaleString("pt-BR")} obras encontradas`}
          {!loading && total > 0 && <span className="ml-1">· página {page} de {totalPages.toLocaleString("pt-BR")}</span>}
        </p>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-bold text-muted-foreground">por página:</span>
          {PER_PAGE_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setPerPage(n)}
              className={`rounded-lg px-2.5 py-1 font-bold transition ${perPage === n ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: Math.min(perPage, 60) }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="skel aspect-[2/3] w-full rounded-2xl" />
              <div className="skel h-3.5 w-4/5 rounded" />
              <div className="skel h-3 w-3/5 rounded" />
            </div>
          ))}
        </div>
      ) : items.length > 0 ? (
        <CardGrid items={items} />
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-16 text-center">
          <Compass className="h-8 w-8 text-muted-foreground" />
          <p className="font-bold">Nada no catálogo local com esses filtros</p>
          <p className="max-w-md text-xs text-muted-foreground">Tente limpar filtros ou busque ao vivo — se a obra existir na base global, a Aoi do sistema traz ela pra cá na hora.</p>
        </div>
      )}

      {/* busca ao vivo */}
      {liveResults && liveResults.length > 0 && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="mb-1 text-xs font-black uppercase tracking-wider text-primary">Resultados ao vivo da fonte global</p>
          <p className="mb-3 text-[11px] text-muted-foreground">Encontrados fora do catálogo local — clique para abrir (a obra é adicionada ao OtakuVerse automaticamente).</p>
          <CardGrid items={liveResults} />
        </section>
      )}

      {/* paginação */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-bold disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <span className="px-3 text-sm font-bold text-muted-foreground">{page} / {totalPages.toLocaleString("pt-BR")}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="flex h-9 items-center gap-1 rounded-xl border border-border bg-card px-3 text-sm font-bold disabled:opacity-40"
          >
            Próxima <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
