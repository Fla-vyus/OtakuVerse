"use client";

import { useEffect, useState } from "react";
import { BookMarked, Loader2, Clock, Building2, ChevronRight } from "lucide-react";
import { usePortal } from "./store";

interface MagEntry {
  name: string;
  publisher: string | null;
  demographic: string | null;
  schedule: string | null;
  country: string | null;
  count: number;
  covers: { id: string; title: string; cover: string; coverColor: string | null }[];
  sample: { id: string; title: string }[];
}

const DEMO_LABEL: Record<string, string> = {
  shonen: "Shonen",
  seinen: "Seinen",
  shojo: "Shojo",
  josei: "Josei",
  web: "Webtoon/Web",
  varias: "Várias",
};

export function MagazinesView() {
  const openExplore = usePortal((s) => s.openExplore);
  const [data, setData] = useState<{ magazines: MagEntry[]; worksWithMagazine: number } | null>(null);

  useEffect(() => {
    fetch("/api/magazines")
      .then((r) => r.json())
      .then((d) => (d.ok ? setData(d) : null))
      .catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <BookMarked className="h-6 w-6 text-primary" /> Revistas & Editoras
        </h1>
        <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
          Onde cada obra é publicada de verdade: revistas semanais, mensais e webtoons com seus cadernos de lançamentos.
          Clique numa revista para ver todas as obras dela.
          {data && ` · ${data.worksWithMagazine.toLocaleString("pt-BR")} obras com revista identificada`}
        </p>
      </div>

      {!data && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Carregando revistas...
        </div>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.magazines.map((m) => (
            <button
              key={m.name}
              onClick={() => openExplore({ mag: m.name, q: "" })}
              className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{m.name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" /> {m.publisher ?? "Editora não informada"}
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black text-primary">
                  {m.count} obras
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-muted-foreground">
                {m.demographic && (
                  <span className="rounded-md bg-secondary px-1.5 py-0.5 uppercase tracking-wide">{DEMO_LABEL[m.demographic] ?? m.demographic}</span>
                )}
                {m.schedule && (
                  <span className="flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5">
                    <Clock className="h-2.5 w-2.5" /> {m.schedule}
                  </span>
                )}
              </div>

              {/* faixa de capas reais */}
              <div className="flex gap-1.5">
                {m.covers.slice(0, 4).map((c, i) => (
                  <div
                    key={c.id}
                    className="h-20 w-14 overflow-hidden rounded-md border border-border"
                    style={{ background: c.coverColor ? `${c.coverColor}33` : "var(--muted)", marginLeft: i > 0 ? "-18px" : undefined, zIndex: 10 - i, position: "relative" }}
                  >
                    <img
                      src={`/api/img?u=${encodeURIComponent(c.cover)}`}
                      alt={c.title}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>

              <p className="line-clamp-1 text-[11px] text-muted-foreground">
                {m.sample.map((s) => s.title).join(" · ")}
              </p>

              <span className="flex items-center gap-1 text-xs font-bold text-primary">
                ver obras da revista <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
