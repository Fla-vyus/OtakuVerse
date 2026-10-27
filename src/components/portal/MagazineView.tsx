"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookMarked, Building2, CalendarClock, ChevronLeft, ExternalLink,
  Flame, Library, Loader2, ShieldAlert, Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePortal } from "./store";
import { WorkCard } from "./WorkCard";
import type { WorkData } from "@/lib/types";

interface MagazineSummary {
  key: string;
  name: string;
  native: string;
  publisher: string;
  country: string;
  kind: string;
  demographic: string;
  cadence: string;
  founded: number;
  accepts: string[];
  adult: boolean;
  count: number;
}

interface MagazineFull extends MagazineSummary {
  avoids: string[];
  ecchi: string;
  circulation: string;
  blurb: string;
  site?: string;
  themes?: string[];
}

interface MagazineDetailPayload {
  ok: boolean;
  magazine: MagazineFull;
  total: number;
  genres: { name: string; count: number }[];
  works: WorkData[];
}

const COUNTRY_FLAG: Record<string, string> = { JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳" };
const DEMO_LABEL: Record<string, string> = {
  shonen: "Shonen", shoujo: "Shoujo", seinen: "Seinen", josei: "Josei", geral: "Geral", adulto: "Adulto +18",
};

function fmtCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

function MagazineCard({ m, onClick }: { m: MagazineSummary; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="card-hover group flex h-full flex-col rounded-2xl border border-border bg-card p-4 text-left"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold leading-tight">{m.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{m.native}</p>
        </div>
        <span className="shrink-0 text-lg" aria-hidden>{COUNTRY_FLAG[m.country] ?? ""}</span>
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <span className="rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">{DEMO_LABEL[m.demographic] ?? m.demographic}</span>
        <span className="rounded-md border border-border bg-secondary/60 px-1.5 py-0.5 text-[10px] font-semibold">{m.kind}</span>
        {m.adult && (
          <span className="rounded-md border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-black text-rose-700 dark:text-rose-300">+18</span>
        )}
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        <Building2 className="mr-1 inline h-3 w-3" />{m.publisher} · desde {m.founded}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
        <CalendarClock className="h-3 w-3" /> {m.cadence}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {m.accepts.slice(0, 3).map((a) => (
          <span key={a} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">{a}</span>
        ))}
        {m.accepts.length > 3 && <span className="text-[10px] text-muted-foreground">+{m.accepts.length - 3}</span>}
      </div>
      <p className="mt-auto pt-3 text-[11px] font-bold text-primary">{fmtCount(m.count)} obras no catálogo →</p>
    </button>
  );
}

export function MagazineView() {
  const magazineKey = usePortal((s) => s.magazineKey);
  const openMagazine = usePortal((s) => s.openMagazine);
  const openExplore = usePortal((s) => s.openExplore);
  const openWork = usePortal((s) => s.openWork);
  const adultOk = usePortal((s) => s.adultOk);

  const [list, setList] = useState<MagazineSummary[] | null>(null);
  const [detail, setDetail] = useState<MagazineDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetch("/api/magazines")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setList(d.magazines); })
      .catch(() => {});
  }, []);

  // derive-loading: carrega o detalhe quando magazineKey muda
  useEffect(() => {
    if (!magazineKey) { setDetail(null); setDetailLoading(false); return; }
    let alive = true;
    setDetailLoading(true);
    setDetail(null);
    fetch(`/api/magazines?key=${encodeURIComponent(magazineKey)}&adult=${adultOk() ? 1 : 0}`)
      .then((r) => r.json())
      .then((d) => { if (alive && d.ok) setDetail(d); })
      .catch(() => {})
      .finally(() => { if (alive) setDetailLoading(false); });
    return () => { alive = false; };
  }, [magazineKey, adultOk]);

  const grouped = useMemo(() => {
    const g: Record<string, MagazineSummary[]> = { JP: [], KR: [], CN: [] };
    for (const m of list ?? []) (g[m.country] ??= []).push(m);
    for (const k of Object.keys(g)) g[k].sort((a, b) => b.count - a.count);
    return g;
  }, [list]);

  if (magazineKey) {
    const mag = detail?.magazine;
    return (
      <div className="fade-in space-y-5">
        <Button variant="outline" size="sm" onClick={() => openMagazine("")} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Todas as revistas
        </Button>

        {detailLoading || !mag ? (
          <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <header className="rounded-2xl border border-border bg-card p-5 sm:p-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl" aria-hidden>{COUNTRY_FLAG[mag.country] ?? ""}</span>
                <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{DEMO_LABEL[mag.demographic] ?? mag.demographic}</span>
                <span className="rounded-md border border-border bg-secondary/60 px-2 py-0.5 text-[11px] font-semibold">{mag.kind}</span>
                {mag.adult && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[11px] font-black text-rose-700 dark:text-rose-300">
                    <ShieldAlert className="h-3 w-3" /> publica +18
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{mag.name}</h1>
              <p className="text-sm text-muted-foreground">{mag.native} · {mag.publisher} · desde {mag.founded}</p>
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-foreground/90">{mag.blurb}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {mag.cadence}</span>
                <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> circulação: {mag.circulation}</span>
                <span className="inline-flex items-center gap-1"><Library className="h-3.5 w-3.5" /> {fmtCount(detail!.total)} obras no catálogo</span>
                {mag.site && (
                  <a href={mag.site} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> site oficial
                  </a>
                )}
              </div>
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  <Flame className="h-4 w-4" /> O que essa revista mais publica
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {mag.accepts.map((a) => (
                    <button key={a} onClick={() => openExplore({ mag: mag.name, genre: "all" })}
                      className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-500/20 dark:text-emerald-200">
                      {a}
                    </button>
                  ))}
                </div>
                {detail!.genres.length > 0 && (
                  <>
                    <h3 className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">No catálogo (gêneros reais)</h3>
                    <div className="space-y-1.5">
                      {detail!.genres.slice(0, 5).map((g) => (
                        <div key={g.name} className="flex items-center gap-2">
                          <span className="w-28 shrink-0 truncate text-[11px] font-semibold">{g.name}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${(g.count / detail!.genres[0].count) * 100}%` }} />
                          </div>
                          <span className="w-10 text-right text-[10px] text-muted-foreground">{g.count}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  <ShieldAlert className="h-4 w-4" /> Linha editorial & conteúdo
                </h2>
                <dl className="space-y-2.5 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Ecchi</dt>
                    <dd className="text-right font-semibold">{mag.ecchi === "n/a" ? "revista +18 (explícito é o foco)" : mag.ecchi}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Conteúdo adulto (+18)</dt>
                    <dd className="text-right font-semibold">{mag.adult ? "sim, com selo" : "não publica"}</dd>
                  </div>
                  {mag.avoids.length > 0 && (
                    <div>
                      <dt className="mb-1 text-muted-foreground">Difícil de passar por aqui</dt>
                      <dd className="flex flex-wrap gap-1">
                        {mag.avoids.map((a) => (
                          <span key={a} className="rounded-md border border-rose-500/25 bg-rose-500/5 px-1.5 py-0.5 text-[11px] text-rose-700 dark:text-rose-300">{a}</span>
                        ))}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Formato</dt>
                    <dd className="text-right font-semibold">{mag.country === "JP" ? "revista impressa + digital" : "webtoon vertical full-color"}</dd>
                  </div>
                </dl>
                <Button size="sm" className="mt-4 bg-brand-gradient font-bold text-white hover:brightness-110"
                  onClick={() => openExplore({ mag: mag.name })}>
                  <BookMarked className="h-4 w-4" /> Explorar as {fmtCount(detail!.total)} obras da revista
                </Button>
              </section>
            </div>

            <section>
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                <BookMarked className="h-5 w-5 text-primary" /> Destaques do catálogo
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {detail!.works.slice(0, 24).map((w) => <WorkCard key={w.id} work={w} />)}
              </div>
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
          <BookMarked className="h-6 w-6 text-primary" /> Revistas, selos & plataformas
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Onde as obras nascem: cada revista tem uma linha editorial própria — gêneros que aceita bem,
          nível de picância permitido, cadência e público. Clique para ver o perfil completo e o catálogo.
        </p>
      </header>

      {!list ? (
        <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <>
          {(["JP", "KR", "CN"] as const).map((c) =>
            grouped[c].length ? (
              <section key={c}>
                <h2 className="mb-3 text-lg font-extrabold">
                  {COUNTRY_FLAG[c]} {c === "JP" ? "Japão" : c === "KR" ? "Coreia do Sul" : "China"}
                  <span className="ml-2 text-xs font-medium text-muted-foreground">{grouped[c].length} editoras no catálogo</span>
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {grouped[c].map((m) => <MagazineCard key={m.key} m={m} onClick={() => openMagazine(m.key)} />)}
                </div>
              </section>
            ) : null
          )}
          <p className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            As revistas listadas são reais e refletem a linha editorial de cada editora. As obras do catálogo foram
            distribuídas de acordo com o perfil de cada uma — obras originais (sem serialização) não têm revista.
          </p>
        </>
      )}
    </div>
  );
}
