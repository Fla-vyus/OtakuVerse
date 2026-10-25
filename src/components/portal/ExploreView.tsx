"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, Globe, Loader2, X, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { usePortal, DEFAULT_FILTERS } from "./store";
import { WorkCard, CardSkeleton } from "./WorkCard";
import type { WorkData } from "@/lib/types";

interface Facets {
  genres: { name: string; count: number }[];
  tags: { name: string; count: number }[];
}

const TYPE_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "manga", label: "Mangá 🇯🇵" },
  { value: "manhwa", label: "Manhwa 🇰🇷" },
  { value: "manhua", label: "Manhua 🇨🇳" },
  { value: "lightnovel", label: "Light Novel" },
  { value: "anime", label: "Anime" },
];

const SORT_OPTIONS = [
  { value: "popular", label: "Mais populares" },
  { value: "score", label: "Melhor avaliados" },
  { value: "favorites", label: "Mais favoritados" },
  { value: "new", label: "Lançamentos recentes" },
  { value: "chapters", label: "Mais capítulos" },
  { value: "title", label: "Nome (A–Z)" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Qualquer status" },
  { value: "RELEASING", label: "Em lançamento" },
  { value: "FINISHED", label: "Concluídos" },
  { value: "HIATUS", label: "Em hiato" },
  { value: "NOT_YET_RELEASED", label: "Não lançados" },
];

export function ExploreView() {
  const filters = usePortal((s) => s.filters);
  const setFilters = usePortal((s) => s.setFilters);
  const openWork = usePortal((s) => s.openWork);

  const [items, setItems] = useState<WorkData[] | null>(null);
  const [total, setTotal] = useState(0);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [liveMode, setLiveMode] = useState(false);
  const [liveWorks, setLiveWorks] = useState<WorkData[] | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v && v !== "all") p.set(k, v);
    });
    p.set("page", String(page));
    p.set("perPage", "24");
    return p.toString();
  }, [filters, page]);

  useEffect(() => {
    setPage(1);
  }, [filters.type, filters.genre, filters.tag, filters.status, filters.sort, filters.q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/works?${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) {
          setItems(d.items);
          setTotal(d.total);
          if (d.facets) setFacets(d.facets);
        }
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [qs]);

  const runLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveMode(true);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: filters.q, type: filters.type === "anime" ? "ANIME" : filters.type === "all" ? undefined : "MANGA" }),
      });
      const d = await res.json();
      if (d.ok) {
        setLiveWorks(d.works);
        setTotal(d.works.length);
      }
    } catch {
      // mantém resultados locais
    } finally {
      setLiveLoading(false);
    }
  }, [filters.q, filters.type]);

  const activeChips = useMemo(() => {
    const chips: { label: string; clear: () => void }[] = [];
    if (filters.q) chips.push({ label: `"${filters.q}"`, clear: () => setFilters({ q: "" }) });
    if (filters.type !== "all") chips.push({ label: TYPE_OPTIONS.find((t) => t.value === filters.type)?.label ?? filters.type, clear: () => setFilters({ type: "all" }) });
    if (filters.genre !== "all") chips.push({ label: filters.genre, clear: () => setFilters({ genre: "all" }) });
    if (filters.tag !== "all") chips.push({ label: `tag: ${filters.tag}`, clear: () => setFilters({ tag: "all" }) });
    if (filters.status !== "all") chips.push({ label: STATUS_OPTIONS.find((s) => s.value === filters.status)?.label ?? filters.status, clear: () => setFilters({ status: "all" }) });
    return chips;
  }, [filters, setFilters]);

  const shown = liveMode && liveWorks ? liveWorks : items;

  return (
    <div className="fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Explorar <span className="text-gradient">catálogo</span></h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filtre por tipo, gêneros, tags, status e ordenação — {total} obra(s) encontrada(s).
        </p>
      </div>

      {/* Barra de busca + filtros principais */}
      <div className="space-y-3 rounded-2xl border border-white/8 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(e) => setFilters({ q: e.target.value })}
              placeholder="Buscar por nome, autor, título alternativo..."
              className="pl-9"
              aria-label="Buscar obras"
            />
            {filters.q && (
              <button onClick={() => setFilters({ q: "" })} aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={filters.sort} onValueChange={(v) => setFilters({ sort: v })}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Ordenação"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.type} onValueChange={(v) => setFilters({ type: v })}>
            <SelectTrigger className="w-full sm:w-[180px]" aria-label="Tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={filters.genre} onValueChange={(v) => setFilters({ genre: v })}>
            <SelectTrigger className="w-full sm:w-[200px]" aria-label="Gênero"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72">
              <SelectItem value="all">Todos os gêneros</SelectItem>
              {facets?.genres.map((g) => (
                <SelectItem key={g.name} value={g.name}>{g.name} ({g.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.tag} onValueChange={(v) => setFilters({ tag: v })}>
            <SelectTrigger className="w-full sm:w-[220px]" aria-label="Tag"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-72 custom-scrollbar">
              <SelectItem value="all">Todas as tags</SelectItem>
              {facets?.tags.map((t) => (
                <SelectItem key={t.name} value={t.name}>{t.name} ({t.count})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(v) => setFilters({ status: v })}>
            <SelectTrigger className="w-full sm:w-[190px]" aria-label="Status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {activeChips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {activeChips.map((c, i) => (
              <Badge key={i} variant="secondary" className="cursor-pointer gap-1 border border-primary/30 bg-primary/10 text-violet-200 hover:bg-primary/20"
                onClick={c.clear}>
                {c.label} <X className="h-3 w-3" />
              </Badge>
            ))}
            <button onClick={() => setFilters({ ...DEFAULT_FILTERS })} className="text-xs text-muted-foreground underline hover:text-foreground">
              limpar tudo
            </button>
          </div>
        )}
      </div>

      {/* Busca ao vivo AniList */}
      <div className="flex flex-col items-start justify-between gap-2 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3 sm:flex-row sm:items-center">
        <p className="text-[13px] text-muted-foreground">
          <Sparkles className="mr-1 inline h-3.5 w-3.5 text-violet-300" />
          Não achou no catálogo? Busque <b className="text-foreground">toda a base da AniList</b> ao vivo — o resultado entra no portal.
        </p>
        <Button size="sm" variant="outline" onClick={runLive} disabled={liveLoading}
          className="border-primary/40 text-violet-200 hover:bg-primary/15 hover:text-white">
          {liveLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
          {liveLoading ? "Consultando..." : "Buscar na AniList"}
        </Button>
      </div>
      {liveMode && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>mostrando resultados ao vivo da AniList</span>
          <button onClick={() => { setLiveMode(false); setLiveWorks(null); }} className="underline hover:text-foreground">
            voltar ao catálogo local
          </button>
        </div>
      )}

      {/* Grid */}
      {loading && !shown ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 18 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {shown?.map((w) => <WorkCard key={w.id} work={w} />)}
          </div>
          {shown && shown.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-card/60 p-10 text-center">
              <SlidersHorizontal className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <p className="font-bold">Nenhuma obra com esses filtros</p>
              <p className="mt-1 text-sm text-muted-foreground">Tente limpar filtros ou buscar na AniList ao vivo acima.</p>
            </div>
          )}
          {!liveMode && total > 24 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {Math.ceil(total / 24)}
              </span>
              <Button variant="outline" size="sm" disabled={page * 24 >= total} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
