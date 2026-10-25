"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Star, Users, Heart, Layers, BookOpen, CalendarDays, Clock,
  Sparkles, Loader2, Languages, ExternalLink, User, Flame, Globe,
  Newspaper, Bird, Database, ShoppingBag, Info, Tv, BookMarked, BadgeCheck, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  TYPE_LABEL, STATUS_LABEL, fmtDate, fmtNum, getLanguages, getNextRelease, mainAuthors,
  COUNTRY_FLAG, type WorkData, type LangInfo,
} from "@/lib/types";
import { usePortal } from "./store";
import { WorkCard, TypeBadge, ScoreBadge } from "./WorkCard";
import { AoiMarkdown } from "./AoiMarkdown";
import type { RelatedBundle } from "@/lib/works";

interface DetailPayload {
  ok: boolean;
  work: WorkData;
  related: RelatedBundle;
}

function LangChip({ l }: { l: LangInfo }) {
  const style =
    l.status === "original" ? "border-white/20 bg-white/10 text-white"
    : l.status === "oficial" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
    : l.status === "streaming" ? "border-pink-500/40 bg-pink-500/10 text-pink-200"
    : "border-amber-500/40 bg-amber-500/10 text-amber-200";
  const label =
    l.status === "original" ? "🇴 original"
    : l.status === "oficial" ? "✓ oficial"
    : l.status === "streaming" ? "▶ streaming"
    : "~ provável";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${style}`}>
      <Languages className="h-3.5 w-3.5" /> {l.label} · <span className="opacity-80">{label}</span>
    </span>
  );
}

function StatBox({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-card/70 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1 text-base font-extrabold leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function TagChips({ work }: { work: WorkData }) {
  const openExplore = usePortal((s) => s.openExplore);
  return (
    <div className="flex flex-wrap gap-1.5">
      {work.tags.slice(0, 26).map((t) => (
        <button
          key={t.name}
          onClick={() => openExplore({ tag: t.name, genre: "all" })}
          title={`Relevância ${t.rank}%`}
          className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition hover:scale-105 ${
            t.rank >= 80
              ? "border-primary/35 bg-primary/10 text-violet-200 hover:bg-primary/20"
              : t.rank >= 60
              ? "border-white/12 bg-white/6 text-foreground/85 hover:bg-white/10"
              : "border-white/8 bg-transparent text-muted-foreground hover:bg-white/6"
          }`}
        >
          {t.name} <span className="opacity-50">{t.rank}</span>
        </button>
      ))}
    </div>
  );
}

const LINK_META: Record<string, { icon: React.ReactNode; group: string }> = {
  "MangaPlus": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Webtoons": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Webtoon": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Comikey": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Tapas": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Tappytoon": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Lezhin": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Bilibili Comics": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "VIZ": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Kodansha": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "Yen Press": { icon: <BookMarked className="h-4 w-4" />, group: "Oficial (leitura)" },
  "BookWalker": { icon: <ShoppingBag className="h-4 w-4" />, group: "Oficial (loja)" },
  "Amazon": { icon: <ShoppingBag className="h-4 w-4" />, group: "Oficial (loja)" },
  "Netflix": { icon: <Tv className="h-4 w-4" />, group: "Streaming" },
  "Crunchyroll": { icon: <Tv className="h-4 w-4" />, group: "Streaming" },
  "Hulu": { icon: <Tv className="h-4 w-4" />, group: "Streaming" },
  "HIDIVE": { icon: <Tv className="h-4 w-4" />, group: "Streaming" },
  "Amazon Prime Video": { icon: <Tv className="h-4 w-4" />, group: "Streaming" },
  "MangaUpdates": { icon: <Database className="h-4 w-4" />, group: "Info & comunidade" },
  "Anime-Planet": { icon: <Database className="h-4 w-4" />, group: "Info & comunidade" },
  "AniList": { icon: <Database className="h-4 w-4" />, group: "Info & comunidade" },
  "NovelUpdates": { icon: <Database className="h-4 w-4" />, group: "Info & comunidade" },
  "LiveChart": { icon: <Database className="h-4 w-4" />, group: "Info & comunidade" },
  "Twitter": { icon: <Bird className="h-4 w-4" />, group: "Redes & notícias" },
  "Official Site": { icon: <BadgeCheck className="h-4 w-4" />, group: "Oficial (site)" },
};

function LinksPanel({ work }: { work: WorkData }) {
  const groups = new Map<string, { site: string; url: string; color?: string | null }[]>();
  for (const l of work.extLinks ?? []) {
    const meta = LINK_META[l.site];
    const group = meta?.group ?? (l.type === "STREAMING" ? "Streaming" : l.type === "SOCIAL" ? "Redes & notícias" : "Outros");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push({ site: l.site, url: l.url, color: l.color });
  }

  const mal = work.malId
    ? work.type === "anime"
      ? `https://myanimelist.net/anime/${work.malId}`
      : `https://myanimelist.net/manga/${work.malId}`
    : null;
  const built: { site: string; url: string; icon: React.ReactNode; desc: string }[] = [];
  if (mal) built.push({ site: "MyAnimeList", url: mal, icon: <Star className="h-4 w-4" />, desc: "Scores, reviews e listas da comunidade" });
  built.push({ site: "X (Twitter)", url: `https://x.com/search?q=${encodeURIComponent(work.title)}&f=live`, icon: <Bird className="h-4 w-4" />, desc: "fãs, artistas e notícias em tempo real" });
  built.push({ site: "MangaUpdates", url: `https://www.mangaupdates.com/series.html?search=${encodeURIComponent(work.titleEn ?? work.title)}`, icon: <Database className="h-4 w-4" />, desc: "licenciamentos, scans e publicação" });
  built.push({ site: "Google Notícias", url: `https://news.google.com/search?q=${encodeURIComponent(work.title + " manga")}`, icon: <Newspaper className="h-4 w-4" />, desc: "anúncios de anime, capítulos e novidades" });
  if (work.type === "lightnovel")
    built.push({ site: "NovelUpdates", url: `https://www.novelupdates.com/?s=${encodeURIComponent(work.titleEn ?? work.title)}`, icon: <BookOpen className="h-4 w-4" />, desc: "lançamentos de traduções da LN" });

  const groupOrder = ["Oficial (leitura)", "Oficial (site)", "Oficial (loja)", "Streaming", "Info & comunidade", "Redes & notícias", "Outros"];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3 text-[12px] text-amber-100/80">
        <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
        Portais oficiais apoiam os autores — sempre que existir, leia por lá. Links de comunidade servem pra acompanhar lançamentos, licenciamentos e discussões.
      </div>
      {[...groups.entries()].sort((a, b) => groupOrder.indexOf(a[0]) - groupOrder.indexOf(b[0])).map(([group, links]) => (
        <div key={group}>
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">{group}</h4>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l, i) => (
              <a key={`${l.site}-${l.url}-${i}`} href={l.url} target="_blank" rel="noopener noreferrer"
                className="group flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-card/70 p-3 transition hover:border-primary/40 hover:bg-card">
                <span className="flex items-center gap-2.5 overflow-hidden">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/6 text-foreground/80 group-hover:text-primary">
                    {LINK_META[l.site]?.icon ?? <Globe className="h-4 w-4" />}
                  </span>
                  <span className="truncate text-sm font-semibold">{l.site}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </a>
            ))}
          </div>
        </div>
      ))}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Radar externo (gerados pra essa obra)</h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {built.map((l) => (
            <a key={l.site} href={l.url} target="_blank" rel="noopener noreferrer"
              className="group rounded-xl border border-white/8 bg-card/70 p-3 transition hover:border-primary/40 hover:bg-card">
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/6 text-foreground/80 group-hover:text-primary">{l.icon}</span>
                  <span className="text-sm font-semibold">{l.site}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
              </span>
              <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">{l.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnalysisPanel({ work, onSynopsis }: { work: WorkData; onSynopsis: (pt: string) => void }) {
  const { toast } = useToast();
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const phases = ["Lendo os dados da obra...", "Cruzando tags e parecidas...", "Aoi escrevendo o veredito..."];

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setPhase((p) => (p + 1) % phases.length), 1600);
    return () => clearInterval(t);
  }, [loading]);

  const run = async () => {
    setLoading(true);
    setAnalysis(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: work.id }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setAnalysis(d.analysis);
      if (d.synopsisPT) onSynopsis(d.synopsisPT);
    } catch (e: any) {
      toast({ title: "A IA pisou na bola", description: e.message ?? "Tente de novo em instantes.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-10 text-center">
        <span className="bg-brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg shadow-violet-950/40">
          🍡
        </span>
        <div>
          <p className="font-extrabold">Análise da curadora IA — Aoi</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Ela cruza nota, tags, parecidas e histórico pra gerar um veredito honesto: arte, história, ritmo, nível de picância e pra quem é.
          </p>
        </div>
        <Button onClick={run} className="bg-brand-gradient font-bold text-white hover:brightness-110">
          <Sparkles className="h-4 w-4" /> Gerar análise em português
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/25 bg-card/60 p-10 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-violet-200">{phases[phase]}</p>
        <p className="text-xs text-muted-foreground">a Aoi está caprichando — costuma levar ~15s</p>
      </div>
    );
  }

  return (
    <div className="fade-in rounded-2xl border border-primary/25 bg-card/70 p-5 sm:p-7">
      <div className="markdown-aoi">
        <AoiMarkdown content={analysis ?? ""} />
      </div>
      <div className="mt-5 flex justify-end">
        <Button variant="outline" size="sm" onClick={run} disabled={loading} className="border-primary/30 text-violet-200 hover:bg-primary/10">
          <Sparkles className="h-3.5 w-3.5" /> Regenerar análise
        </Button>
      </div>
    </div>
  );
}

export function DetailView({ workId }: { workId: string }) {
  const go = usePortal((s) => s.go);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [synopsisPT, setSynopsisPT] = useState<string | null>(null);
  const [ptLoading, setPtLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    setSynopsisPT(null);
    fetch(`/api/works/${workId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.ok) setData(d);
        else setError(d.error ?? "Obra não encontrada");
      })
      .catch(() => alive && setError("Falha ao carregar a obra"));
    return () => { alive = false; };
  }, [workId]);

  const work = data?.work;
  const next = useMemo(() => (work ? getNextRelease(work) : null), [work]);
  const langs = useMemo(() => (work ? getLanguages(work) : []), [work]);

  const loadPT = async () => {
    if (!work) return;
    setPtLoading(true);
    try {
      const res = await fetch("/api/ai/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: work.id }),
      });
      const d = await res.json();
      if (d.ok && d.synopsisPT) setSynopsisPT(d.synopsisPT);
    } finally {
      setPtLoading(false);
    }
  };

  if (error) {
    return (
      <div className="fade-in mx-auto max-w-md rounded-2xl border border-white/8 bg-card p-10 text-center">
        <p className="font-bold">{error}</p>
        <Button variant="outline" className="mt-4" onClick={() => go("home")}>
          <ArrowLeft className="h-4 w-4" /> Voltar ao início
        </Button>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-[280px] rounded-2xl" />
        <div className="shimmer h-8 w-2/3 rounded" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="shimmer h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const orderedAuthors = mainAuthors(work);
  const authorLine = orderedAuthors.length > 0
    ? orderedAuthors.map((a) => `${a.name}${a.role ? ` (${a.role})` : ""}`).join(" · ")
    : "—";
  const primaryAuthor = orderedAuthors[0]?.name ?? "—";
  const primaryAuthorRole = orderedAuthors[0]?.role;

  return (
    <div className="fade-in space-y-6">
      {/* Banner + identidade */}
      <section className="relative overflow-hidden rounded-2xl border border-white/8">
        <div className="relative h-[240px] sm:h-[300px]">
          {work.banner ? (
            <img src={work.banner} alt={`Arte de fundo de ${work.title}`} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-violet-950 via-fuchsia-950/60 to-slate-950" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#07070d] via-[#07070db0]/70 to-transparent" />
        </div>
        <div className="relative -mt-24 flex flex-col gap-5 p-5 sm:-mt-28 sm:flex-row sm:p-7">
          <div className="w-32 shrink-0 sm:w-44">
            <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl shadow-black/60">
              <img src={work.cover} alt={`Capa de ${work.title}`} className="aspect-[2/3] w-full object-cover" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <TypeBadge type={work.type} />
              <ScoreBadge score={work.avgScore} />
              <span className="text-xs text-muted-foreground">{COUNTRY_FLAG[work.country ?? ""] ?? ""} {STATUS_LABEL[work.status ?? ""] ?? work.status}</span>
            </div>
            <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{work.title}</h1>
            {(work.titleEn || work.titleNative) && (
              <p className="mt-1 text-sm text-muted-foreground">
                {[work.titleEn !== work.title ? work.titleEn : null, work.titleNative].filter(Boolean).join(" · ")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {fmtNum(work.popularity)} leitores</span>
              <span className="inline-flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {fmtNum(work.favourites)} favoritos</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> {fmtDate(work.startDate)}</span>
              {work.siteUrl && (
                <a href={work.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-300 hover:underline">
                  <ExternalLink className="h-3.5 w-3.5" /> página na AniList
                </a>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {work.genres.map((g) => (
                <span key={g} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold">{g}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats rápidos */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox icon={<Star className="h-3 w-3" />} label="Nota AniList" value={work.avgScore != null ? `${work.avgScore}%` : "—"} hint={`${fmtNum(work.favourites)} favoritos`} />
        <StatBox icon={<Layers className="h-3 w-3" />} label={work.type === "anime" ? "Episódios" : "Capítulos"} value={String(work.type === "anime" ? work.episodes ?? "—" : work.chapters ?? "—")} hint={work.volumes ? `${work.volumes} volumes` : work.duration ? `${work.duration} min/ep` : undefined} />
        <StatBox icon={<BookOpen className="h-3 w-3" />} label="Status" value={STATUS_LABEL[work.status ?? ""] ?? work.status ?? "—"} hint={work.source ? `fonte: ${work.source.toLowerCase()}` : undefined} />
        <StatBox icon={<Clock className="h-3 w-3" />} label={next?.kind === "anime" ? "Próx. episódio" : "Próx. capítulo"} value={next?.label ?? "—"} hint={next?.detail} />
        <StatBox icon={<CalendarDays className="h-3 w-3" />} label="Início" value={fmtDate(work.startDate)} hint={work.endDate ? `fim: ${fmtDate(work.endDate)}` : undefined} />
        <StatBox icon={<User className="h-3 w-3" />} label="Autoria" value={primaryAuthor} hint={primaryAuthorRole} />
      </section>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-card/70 p-1 sm:flex-nowrap">
          <TabsTrigger value="geral" className="flex-1 gap-1.5"><Info className="h-3.5 w-3.5" /> Visão geral</TabsTrigger>
          <TabsTrigger value="links" className="flex-1 gap-1.5"><Globe className="h-3.5 w-3.5" /> Onde ler & links</TabsTrigger>
          <TabsTrigger value="parecidas" className="flex-1 gap-1.5"><Flame className="h-3.5 w-3.5" /> Parecidas</TabsTrigger>
          <TabsTrigger value="ia" className="flex-1 gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Análise IA</TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="mt-4 space-y-6">
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-5 lg:col-span-2">
              <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                    <Languages className="h-4 w-4" /> Idiomas disponíveis
                  </h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {langs.map((l) => <LangChip key={l.code + l.status} l={l} />)}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Original + idiomas com publicação oficial detectada pelos portais linkados. “Provável” = obras de grande porte quase sempre licenciadas (ex.: editoras BR). Confirme na aba “Onde ler & links”.
                </p>
              </div>

              <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
                <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">Sinopse</h3>
                {synopsisPT ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{synopsisPT}</p>
                ) : work.synopsisPT ? (
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{work.synopsisPT}</p>
                ) : (
                  <>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{work.synopsis ?? "Sem sinopse disponível."}</p>
                    <Button size="sm" variant="outline" onClick={loadPT} disabled={ptLoading}
                      className="mt-3 border-primary/30 text-violet-200 hover:bg-primary/10">
                      {ptLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                      Traduzir com IA (PT-BR)
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  <User className="h-4 w-4" /> Autoria & dados
                </h3>
                <p className="text-sm font-semibold">{authorLine}</p>
                <dl className="mt-4 space-y-2 text-[13px]">
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Origem</dt><dd>{COUNTRY_FLAG[work.country ?? ""] ?? "—"} {work.country ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Formato</dt><dd>{work.format ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Volumos</dt><dd>{work.volumes ?? "—"}</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Popularidade</dt><dd>#{fmtNum(work.popularity)}</dd></div>
                  {work.idMal && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">ID MAL</dt><dd>{work.idMal}</dd></div>}
                </dl>
              </div>
              <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  <Flame className="h-4 w-4" /> Tags ({work.tags.length})
                </h3>
                <TagChips work={work} />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="links" className="mt-4">
          <LinksPanel work={work} />
        </TabsContent>

        <TabsContent value="parecidas" className="mt-4 space-y-8">
          {data?.related.similar?.length ? (
            <div>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                <Flame className="h-5 w-5 text-orange-400" /> Obras parecidas
                <span className="text-xs font-medium text-muted-foreground">— calculado por sobreposição de tags e gêneros</span>
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.related.similar.map((w) => <WorkCard key={w.id} work={w} />)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Sem parecidas calculadas ainda.</p>
          )}
          {data?.related.also?.length ? (
            <div>
              <h3 className="mb-3 text-lg font-extrabold">Você provavelmente vai curtir também</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {data.related.also.map((w) => <WorkCard key={w.id} work={w} />)}
              </div>
            </div>
          ) : null}
          {data?.related.byAuthor?.map(({ author, works }) => (
            <div key={author}>
              <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                <User className="h-5 w-5 text-violet-300" /> Outras obras de {author}
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {works.map((w) => <WorkCard key={w.id} work={w} />)}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ia" className="mt-4">
          <AnalysisPanel work={work} onSynopsis={setSynopsisPT} />
        </TabsContent>
      </Tabs>

      <div>
        <Button variant="outline" size="sm" onClick={() => go("home")} className="gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar
        </Button>
      </div>
    </div>
  );
}
