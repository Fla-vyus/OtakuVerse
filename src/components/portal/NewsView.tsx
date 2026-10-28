"use client";

import { useEffect, useState } from "react";
import { Newspaper, Loader2, Flame, Rocket, Star, Tv, CalendarClock, RefreshCcw, PenLine } from "lucide-react";
import { usePortal } from "./store";

interface NewsItem {
  id: string; kind: string; title: string; summary: string; body?: string;
  image: string | null; imageWide?: boolean; date: string; workId: string | null; badge: string; source?: string;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  hype: <Flame className="h-3.5 w-3.5" />,
  estreia: <Rocket className="h-3.5 w-3.5" />,
  retorno: <Tv className="h-3.5 w-3.5" />,
  marco: <Star className="h-3.5 w-3.5" />,
  temporada: <CalendarClock className="h-3.5 w-3.5" />,
};

function byline(n: NewsItem): string {
  const d = new Date(n.date);
  const when = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return [when, n.source ? `fonte: ${n.source}` : "Redação OtakuVerse"].filter(Boolean).join(" · ");
}

/** Imagem da notícia SEM distorção nem pixel estourado:
 *  - banner (paisagem, 1050px) → object-cover preenche o recorte;
 *  - capa retrato (~460px, extraLarge) → contain em cima de um fundo desfocado
 *    da própria capa (padrão editorial) — nunca estica nem zooma 3x. */
function NewsImage({ item, eager }: { item: NewsItem; eager?: boolean }) {
  if (!item.image) return <div className="bg-hero-grad h-full w-full" />;
  const src = `/api/img?u=${encodeURIComponent(item.image)}`;
  const wide = item.imageWide === true;
  return (
    <>
      {!wide && (
        <img
          src={src}
          alt=""
          aria-hidden
          loading={eager ? "eager" : "lazy"}
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-xl"
        />
      )}
      <img
        src={src}
        alt={item.title}
        loading={eager ? "eager" : "lazy"}
        referrerPolicy="no-referrer"
        className={`relative h-full w-full transition duration-500 group-hover:scale-[1.02] ${wide ? "object-cover" : "object-contain"}`}
      />
    </>
  );
}

function Materias() {
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
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <button onClick={load} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground transition hover:text-foreground" title="Atualizar notícias">
          <RefreshCcw className="h-3 w-3" /> Atualizar
        </button>
      </div>

      {!items && !failed ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : failed ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5 sm:flex-row sm:items-center">
          <p className="flex-1 text-sm text-muted-foreground">Não conseguimos carregar as notícias agora — tente novamente.</p>
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
                <NewsImage item={lead} eager />
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
                  <NewsImage item={n} />
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

export function NewsView() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Newspaper className="h-6 w-6 text-primary" /> Central de Notícias
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          O pulso do mundo otaku: matérias escritas pela redação a partir dos números reais do catálogo —
          hype do momento, estreias, retornos e marcos históricos. Renova automaticamente.
        </p>
      </div>
      <Materias />
    </div>
  );
}
