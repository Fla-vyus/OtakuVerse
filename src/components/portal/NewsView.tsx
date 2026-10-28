"use client";

import { useEffect, useMemo, useState } from "react";
import { Newspaper, Loader2, Flame, Rocket, Star, Tv, CalendarClock, RefreshCcw, ExternalLink, PenLine, Radio, MessageSquare, ChevronDown } from "lucide-react";
import { usePortal } from "./store";

interface NewsItem {
  id: string; kind: string; title: string; summary: string; body?: string;
  image: string | null; date: string; workId: string | null; badge: string; source?: string;
}

interface FeedPost {
  id: string; kind: string; source: string; handle: string | null;
  title: string | null; body: string; image: string | null; url: string | null;
  workId: string | null; tags: string[]; at: string; stale?: boolean;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  hype: <Flame className="h-3.5 w-3.5" />,
  estreia: <Rocket className="h-3.5 w-3.5" />,
  retorno: <Tv className="h-3.5 w-3.5" />,
  marco: <Star className="h-3.5 w-3.5" />,
  temporada: <CalendarClock className="h-3.5 w-3.5" />,
};

function relTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  if (diff < 0) return "agora";
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `há ${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** Badge colorido por fonte — cores fixas dão identidade instantânea ao feed */
function SourceBadge({ post }: { post: FeedPost }) {
  if (post.kind === "editorial") {
    return (
      <span className="bg-brand-gradient inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow">
        <PenLine className="h-2.5 w-2.5" /> Redação OtakuVerse
      </span>
    );
  }
  if (post.source.startsWith("Reddit")) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-600 ring-1 ring-orange-500/25 dark:text-orange-400">
        <MessageSquare className="h-2.5 w-2.5" /> {post.source}
      </span>
    );
  }
  if (post.source === "Kitsu") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-cyan-700 ring-1 ring-cyan-500/25 dark:text-cyan-300">
        <Radio className="h-2.5 w-2.5" /> Kitsu
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-muted-foreground">
      <Newspaper className="h-2.5 w-2.5" /> {post.source}
    </span>
  );
}

/** reduz thumbnail do Reddit (140px) para versão nítida (640px) */
function bigThumb(u: string): string {
  return u.replace(/width=\d+/, "width=640").replace(/&crop=\d+/, "");
}

function FeedCard({ post }: { post: FeedPost }) {
  const openWork = usePortal((s) => s.openWork);
  const [expanded, setExpanded] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const editorial = post.kind === "editorial";
  const img = post.image && imgOk ? (post.source.startsWith("Reddit") ? bigThumb(post.image) : post.image) : null;

  return (
    <article className={`overflow-hidden rounded-2xl border bg-card transition hover:shadow-md ${editorial ? "border-primary/25" : "border-border"}`}>
      <div className="flex items-center justify-between gap-2 px-3.5 pt-3 sm:px-5 sm:pt-4">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <SourceBadge post={post} />
          {post.handle && <span className="truncate text-[10px] font-semibold text-muted-foreground">por {post.handle}</span>}
        </div>
        <time className="shrink-0 text-[10px] font-semibold text-muted-foreground">{relTime(post.at)}</time>
      </div>

      {img && (
        <div className="mt-2.5 px-3.5 sm:px-5">
          <button
            onClick={(e) => { e.stopPropagation(); if (post.workId) openWork(post.workId); }}
            className={`block w-full overflow-hidden rounded-xl bg-muted ${editorial ? "aspect-[21/9]" : "aspect-[21/6]"} ${post.workId ? "cursor-pointer" : "cursor-default"}`}
            aria-label={post.title ?? "Imagem do post"}
          >
            <img
              src={`/api/img?u=${encodeURIComponent(img)}`}
              alt={post.title ?? ""}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImgOk(false)}
              className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
            />
          </button>
        </div>
      )}

      <div className="px-3.5 pb-3.5 pt-2.5 sm:px-5 sm:pb-4">
        {post.title && <h3 className={`font-black leading-snug ${editorial ? "text-base sm:text-lg" : "text-sm sm:text-[15px]"}`}>{post.title}</h3>}
        <div className={`mt-1.5 space-y-2 text-[13px] leading-relaxed text-foreground/85 sm:text-sm ${expanded ? "" : "line-clamp-3"}`}>
          {post.body.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {post.body.length > 220 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-0.5 -mb-1 flex min-h-[36px] items-center gap-1 py-2 pr-3 text-[11px] font-bold text-primary hover:underline"
          >
            {expanded ? "recolher" : "ler mais"} <ChevronDown className={`h-3 w-3 transition ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {post.workId && (
            <button onClick={() => openWork(post.workId!)} className="flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary/10">
              ver a obra no catálogo →
            </button>
          )}
          {post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground transition hover:text-foreground">
              post original <ExternalLink className="h-3 w-3" />
            </a>
          )}
          {post.tags.slice(0, 3).map((t) => (
            <span key={t} className="rounded-md bg-secondary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">#{t}</span>
          ))}
        </div>
      </div>
    </article>
  );
}

function FeedTab() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  async function load() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch("/api/feed", { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      setPosts(d.ok ? d.posts : []);
      if (!d.ok) setFailed(true);
    } catch {
      setFailed(true);
      setPosts([]);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, []);

  const sources = useMemo(() => {
    if (!posts) return [];
    const set = new Map<string, number>();
    for (const p of posts) {
      const key = p.kind === "editorial" ? "editorial" : p.source.startsWith("Reddit") ? "reddit" : p.source.toLowerCase();
      set.set(key, (set.get(key) ?? 0) + 1);
    }
    return [...set.entries()];
  }, [posts]);

  const filtered = posts?.filter((p) => {
    if (filter === "all") return true;
    if (filter === "editorial") return p.kind === "editorial";
    if (filter === "reddit") return p.source.startsWith("Reddit");
    if (filter === "kitsu") return p.source === "Kitsu";
    return p.source.toLowerCase() === filter;
  }) ?? [];

  // no modo "Tudo", o editorial mais recente fica FIXADO no topo (matéria de capa)
  // — sem isso ele afunda no timeline abaixo dos reposts mais novos
  const pinned = filter === "all" ? filtered.find((p) => p.kind === "editorial") : undefined;
  const rest = pinned ? filtered.filter((p) => p !== pinned) : filtered;

  const FILTER_LABEL: Record<string, string> = {
    all: "Tudo", editorial: "Redação OtakuVerse", reddit: "Reddit", kitsu: "Kitsu",
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Reposts ao vivo de fontes reais — comunidade (Reddit), trending oficial (Kitsu) e matérias escritas pela
          nossa redação. Atualizado automaticamente a cada 6h.
        </p>
        <button onClick={load} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:text-foreground" title="Atualizar feed">
          <RefreshCcw className="h-3 w-3" /> Atualizar
        </button>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {["all", "editorial", "reddit", "kitsu"].map((k) => {
          const count = sources.find(([s]) => s === k)?.[1];
          return (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                filter === k ? "bg-primary text-primary-foreground shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {FILTER_LABEL[k]}{count ? ` · ${count}` : ""}
            </button>
          );
        })}
      </div>

      {!posts && !failed ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 4 }, (_, i) => <div key={i} className="skel h-32 rounded-2xl" />)}
        </div>
      ) : failed ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">Não conseguimos carregar o feed agora — tente novamente.</p>
          <button onClick={() => { setFailed(false); load(); }} className="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110">
            <RefreshCcw className="h-4 w-4" /> Recarregar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-14 text-center text-sm text-muted-foreground">
          Nada desta fonte por agora — o feed renova a cada 6h.
        </div>
      ) : (
        <div className="flex flex-col gap-3 sm:gap-4">
          {pinned && <FeedCard key={pinned.id} post={pinned} />}
          {rest.map((p) => <FeedCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}

function byline(n: NewsItem): string {
  const d = new Date(n.date);
  const when = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return [when, n.source ? `fonte: ${n.source}` : "Redação OtakuVerse"].filter(Boolean).join(" · ");
}

function MateriasTab() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const openWork = usePortal((s) => s.openWork);

  async function load() {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch("/api/news", { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      setItems(d.ok ? d.items : []);
      if (!d.ok) setFailed(true);
    } catch {
      setFailed(true);
      setItems([]);
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 0); // defer 1 tick (padrão do projeto p/ set-state-in-effect)
    return () => clearTimeout(t);
  }, []);

  const kinds = [
    { id: "all", label: "Tudo" },
    { id: "hype", label: "Hype agora" },
    { id: "estreia", label: "Estreias" },
    { id: "retorno", label: "Retornos" },
    { id: "marco", label: "Marcos" },
  ];

  const filtered = items?.filter((n) => filter === "all" || n.kind === filter) ?? [];
  const lead = filter === "all" ? filtered[0] : undefined;
  const rest = lead ? filtered.slice(1) : filtered;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {kinds.map((k) => (
          <button
            key={k.id}
            onClick={() => setFilter(k.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
              filter === k.id ? "bg-primary text-primary-foreground shadow" : "border border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {!items && !failed ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : failed ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">Não conseguimos carregar o feed agora — tente novamente.</p>
          <button onClick={() => { setFailed(false); load(); }} className="bg-brand-gradient flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md transition hover:brightness-110">
            <RefreshCcw className="h-4 w-4" /> Recarregar
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Sem itens desta categoria agora — volte mais tarde.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* matéria principal — layout de artigo */}
          {lead && (
            <article
              onClick={() => lead.workId && openWork(lead.workId)}
              className={`group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:shadow-lg ${lead.workId ? "cursor-pointer" : ""}`}
            >
              <div className="relative aspect-video w-full overflow-hidden bg-muted">
                {lead.image ? (
                  <img
                    src={`/api/img?u=${encodeURIComponent(lead.image)}`}
                    alt={lead.title}
                    loading="eager"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="bg-hero-grad h-full w-full" />
                )}
                <span className="bg-brand-gradient absolute left-3 top-3 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase text-white shadow">
                  {KIND_ICON[lead.kind] ?? <Newspaper className="h-3 w-3" />} {lead.badge}
                </span>
              </div>
              <div className="p-5 sm:p-6">
                <h2 className="text-xl font-black leading-snug sm:text-2xl">{lead.title}</h2>
                <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{byline(lead)}</p>
                <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-foreground/90">
                  {(lead.body ?? lead.summary).split("\n\n").map((p, i) => (
                    <p key={i} className={i === 0 ? "font-medium" : ""}>{p}</p>
                  ))}
                </div>
                {lead.workId && (
                  <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
                    ver a obra <span className="transition group-hover:translate-x-0.5">→</span>
                  </span>
                )}
              </div>
            </article>
          )}

          {/* demais matérias — cards com prévia do texto */}
          <div className="grid gap-4 md:grid-cols-2">
            {rest.map((n) => (
              <article
                key={n.id}
                onClick={() => n.workId && openWork(n.workId)}
                className={`group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-lg ${n.workId ? "cursor-pointer" : ""}`}
              >
                <div className="relative aspect-[21/9] w-full overflow-hidden bg-muted">
                  {n.image ? (
                    <img
                      src={`/api/img?u=${encodeURIComponent(n.image)}`}
                      alt={n.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="bg-hero-grad h-full w-full" />
                  )}
                  <span className="bg-brand-gradient absolute left-3 top-3 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-black uppercase text-white shadow">
                    {KIND_ICON[n.kind] ?? <Newspaper className="h-3 w-3" />} {n.badge}
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-sm font-black leading-snug">{n.title}</p>
                  <div className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted-foreground">
                    {(n.body ?? n.summary).split("\n\n").slice(0, 2).map((p, i) => (
                      <p key={i} className="line-clamp-3">{p}</p>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{byline(n)}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type Tab = "feed" | "materias";

export function NewsView() {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Newspaper className="h-6 w-6 text-primary" /> Central de Notícias & Feed
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          O pulso do mundo otaku em um lugar só: feed ao vivo com postagens da comunidade, trending oficial e
          matérias da nossa redação — além das notas geradas a partir dos números reais do catálogo.
        </p>
      </div>

      {/* abas */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "feed"}
          onClick={() => setTab("feed")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:text-sm ${tab === "feed" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Radio className="h-4 w-4" /> Feed ao vivo
        </button>
        <button
          role="tab"
          aria-selected={tab === "materias"}
          onClick={() => setTab("materias")}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition sm:text-sm ${tab === "materias" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}
        >
          <PenLine className="h-4 w-4" /> Matérias
        </button>
      </div>

      {tab === "feed" ? <FeedTab /> : <MateriasTab />}
    </div>
  );
}
