"use client";

import { useEffect, useState } from "react";
import { TrendingUp, Loader2, BookOpen, Trophy, Layers, ExternalLink } from "lucide-react";
import { usePortal } from "./store";
import { fetchJSON } from "@/lib/fetchClient";

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

function fmtCopies(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "") + " mi";
  if (n >= 1000) return Math.round(n / 1000) + " mil";
  return String(n);
}

const YEAR_TABS = [
  { id: "all", label: "Todos os anos" },
  { id: "2024", label: "2024" },
  { id: "2023", label: "2023" },
  { id: "2022", label: "2022" },
  { id: "2021", label: "2021" },
];

export function SalesView() {
  const openWork = usePortal((s) => s.openWork);
  const [tab, setTab] = useState<"volumes" | "series" | "alltime">("volumes");
  const [year, setYear] = useState<string>("2024");
  const [data, setData] = useState<{ volumes: SaleItem[]; series: SaleItem[]; allTime: SaleItem[]; source: string } | null>(null);

  useEffect(() => {
    fetchJSON("/api/sales").then((d) => (d?.ok ? setData(d) : null));
  }, []);

  const list: SaleItem[] = !data
    ? []
    : tab === "volumes"
      ? data.volumes.filter((v) => year === "all" || String(v.year) === year)
      : tab === "series"
        ? data.series.filter((v) => year === "all" || String(v.year) === year)
        : data.allTime;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <TrendingUp className="h-6 w-6 text-primary" /> Vendas de Mangá
          </h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
            Rankings reais de vendas: volumes individuais e séries mais vendidas do ano (dados públicos da Oricon)
            e os acumulados históricos divulgados pelas editoras. Capas do catálogo real.
          </p>
        </div>
      </div>

      {/* abas */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setTab("volumes")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${tab === "volumes" ? "bg-primary text-white shadow-md" : "border border-border bg-card hover:border-primary/40"}`}
        >
          <Layers className="h-4 w-4" /> Volumes mais vendidos
        </button>
        <button
          onClick={() => setTab("series")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${tab === "series" ? "bg-primary text-white shadow-md" : "border border-border bg-card hover:border-primary/40"}`}
        >
          <BookOpen className="h-4 w-4" /> Séries mais vendidas
        </button>
        <button
          onClick={() => setTab("alltime")}
          className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition ${tab === "alltime" ? "bg-primary text-white shadow-md" : "border border-border bg-card hover:border-primary/40"}`}
        >
          <Trophy className="h-4 w-4" /> Todos os tempos
        </button>
      </div>

      {/* filtro de ano */}
      {tab !== "alltime" && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {YEAR_TABS.map((y) => (
            <button
              key={y.id}
              onClick={() => setYear(y.id)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition ${year === y.id ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
            >
              {y.label}
            </button>
          ))}
        </div>
      )}

      {!data && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Carregando rankings de vendas...
        </div>
      )}

      {data && list.length === 0 && (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Sem entradas para este filtro — tente outro ano.
        </p>
      )}

      {/* ranking */}
      {list.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {list.map((it, i) => (
            <button
              key={`${it.series}-${it.volume ?? "s"}-${it.year}-${i}`}
              onClick={() => openWork(it.workId)}
              className="group flex w-full items-center gap-3 border-b border-border p-3 text-left transition last:border-b-0 hover:bg-accent/60"
            >
              <span className={`flex h-8 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-black ${
                i === 0 ? "bg-amber-400 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-orange-700 text-white" : "bg-secondary text-muted-foreground"
              }`}>
                {i + 1}
              </span>
              <div
                className="h-14 w-10 shrink-0 overflow-hidden rounded-md"
                style={{ background: it.coverColor ? `${it.coverColor}33` : "var(--muted)" }}
              >
                <img
                  src={`/api/img?u=${encodeURIComponent(it.cover)}`}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">
                  {it.title}
                  {it.volume != null && <span className="ml-1.5 text-primary">Vol. {it.volume}</span>}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {fmtCopies(it.copies)} de cópias {tab !== "alltime" ? `em ${it.year}` : "acumuladas"}
                  {it.note ? ` · ${it.note}` : ""}
                </p>
              </div>
              <span className="hidden shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black text-primary sm:flex">
                {fmtCopies(it.copies)} <ExternalLink className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
              </span>
            </button>
          ))}
        </div>
      )}

      {data && (
        <p className="text-center text-[11px] text-muted-foreground">{data.source}.</p>
      )}
    </div>
  );
}
