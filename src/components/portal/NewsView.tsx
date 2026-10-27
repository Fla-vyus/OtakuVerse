"use client";

import { useEffect, useState } from "react";
import { Newspaper, Loader2, Flame, Rocket, Star, Tv, CalendarClock } from "lucide-react";
import { usePortal } from "./store";

interface NewsItem {
  id: string; kind: string; title: string; summary: string;
  image: string | null; date: string; workId: string; badge: string;
}

const KIND_ICON: Record<string, React.ReactNode> = {
  hype: <Flame className="h-3.5 w-3.5" />,
  estreia: <Rocket className="h-3.5 w-3.5" />,
  retorno: <Tv className="h-3.5 w-3.5" />,
  marco: <Star className="h-3.5 w-3.5" />,
  temporada: <CalendarClock className="h-3.5 w-3.5" />,
};

export function NewsView() {
  const [items, setItems] = useState<NewsItem[] | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const openWork = usePortal((s) => s.openWork);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((d) => (d.ok ? setItems(d.items) : setItems([])))
      .catch(() => setItems([]));
  }, []);

  const kinds = [
    { id: "all", label: "Tudo" },
    { id: "hype", label: "Hype agora" },
    { id: "estreia", label: "Estreias" },
    { id: "retorno", label: "Retornos" },
    { id: "marco", label: "Marcos" },
  ];

  const filtered = items?.filter((n) => filter === "all" || n.kind === filter) ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <Newspaper className="h-6 w-6 text-primary" /> Central de Notícias
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Feed ao vivo com dados reais do mundo otaku: tendências do momento, estreias, retornos confirmados e marcos de popularidade — com imagem real da obra.
        </p>
      </div>

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

      {!items ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          Sem itens desta categoria agora — volte mais tarde.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((n, i) => (
            <button
              key={n.id}
              onClick={() => openWork(n.workId)}
              className={`group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-lg ${i === 0 && filter === "all" ? "md:col-span-2" : ""}`}
            >
              <div className={`relative w-full overflow-hidden ${i === 0 && filter === "all" ? "aspect-video" : "aspect-[21/9]"} bg-muted`}>
                {n.image ? (
                  <img
                    src={`/api/img?u=${encodeURIComponent(n.image)}`}
                    alt={n.title}
                    loading={i === 0 ? "eager" : "lazy"}
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
                <p className={`font-black leading-snug ${i === 0 && filter === "all" ? "text-lg" : "text-sm"}`}>{n.title}</p>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{n.summary}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {new Date(n.date).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · clique para ver a obra
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
