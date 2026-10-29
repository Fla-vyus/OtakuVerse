"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft, Star, Users, Heart, Layers, BookOpen, CalendarDays, Clock,
  Sparkles, Loader2, Languages, ExternalLink, User, Globe, Library as LibIcon,
  BookmarkCheck, BookPlus, Building2, Newspaper, Tags, ListTree, ShieldAlert, Tv, Languages as LangIcon,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  TYPE_LABEL, STATUS_LABEL, fmtDate, fmtNum, getLanguages, getNextRelease, mainAuthors,
  altNames, COUNTRY_FLAG, type WorkData, type LangInfo, type MagazineInfo,
} from "@/lib/types";
import { usePortal, LIB_STATUS_LABEL, prefetchWork, type LibraryEntry } from "./store";
import { WorkCard } from "./WorkCard";
import { AoiMarkdown } from "./AoiMarkdown";
import BuyPanel from "./BuyPanel";
import AdSlot from "./AdSlot";
import { proxyImg } from "@/lib/imgurl";
import type { RelatedBundle } from "@/lib/works";

interface DetailPayload {
  ok: boolean;
  work: WorkData;
  related: RelatedBundle;
}

function LangChip({ l }: { l: LangInfo }) {
  const style =
    l.status === "original" ? "border-primary/30 bg-primary/10 text-primary"
    : l.status === "oficial" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
    : l.status === "streaming" ? "border-pink-500/40 bg-pink-500/10 text-pink-600 dark:text-pink-300"
    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-300";
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
    <div className="rounded-xl border border-border bg-card p-3">
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
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : t.rank >= 60
              ? "border-border bg-secondary text-foreground/80 hover:bg-accent"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.name} <span className="ml-0.5 text-[9px] opacity-60">{t.rank}%</span>
        </button>
      ))}
      {work.tags.length > 26 && (
        <span className="self-center text-[11px] text-muted-foreground">+{work.tags.length - 26} tags</span>
      )}
    </div>
  );
}

function SynopsisBlock({ work }: { work: WorkData }) {
  const [pt, setPt] = useState<string | null>(work.synopsisPT ?? null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const translate = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const r = await fetch("/api/ai/synopsis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: work.id }),
      });
      const d = await r.json();
      if (d.ok && d.synopsisPT) setPt(d.synopsisPT);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="mb-2 text-sm font-black">Sinopse</p>
      {pt && (
        <div className="mb-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-primary">
            <LangIcon className="h-3 w-3" /> em português (via Aoi)
          </p>
          <p className="text-sm leading-relaxed text-foreground/90">{pt}</p>
        </div>
      )}
      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{work.synopsis ?? "Sinopse não disponível na fonte."}</p>
      {!pt && work.synopsis && (
        <button
          onClick={translate}
          disabled={loading}
          className="mt-3 flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/20 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "A Aoi está traduzindo..." : "Traduzir sinopse para português"}
        </button>
      )}
      {failed && <p className="mt-2 text-[11px] text-destructive">A tradução falhou agora — tente de novo em instantes.</p>}
    </div>
  );
}

function MagazineCard({ mag, network }: { mag: MagazineInfo; network?: string | null }) {
  const openExplore = usePortal((s) => s.openExplore);
  const demoLabel: Record<string, string> = {
    shonen: "Shōnen (adolescente masculino)",
    seinen: "Seinen (adulto masculino)",
    shojo: "Shōjo (adolescente feminino)",
    josei: "Josei (adulto feminino)",
    web: "Publicação web/digital",
    varias: "Variada",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-black">
        <Building2 className="h-4 w-4 text-primary" /> {mag.name}
        {network && network !== mag.name && (
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">exibição: {network}</span>
        )}
      </p>
      {mag.publisher && <p className="mt-0.5 text-xs text-muted-foreground">Publicada por {mag.publisher}</p>}
      <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
        {mag.demographic && (
          <span className="rounded-md border border-border bg-secondary px-2 py-1 font-semibold">Público: {demoLabel[mag.demographic] ?? mag.demographic}</span>
        )}
        {mag.schedule && <span className="rounded-md border border-border bg-secondary px-2 py-1 font-semibold"><Clock className="mr-1 inline h-3 w-3" />{mag.schedule}</span>}
        <span className="rounded-md border border-border bg-secondary px-2 py-1 font-semibold">
          {mag.source === "curado" ? "curado" : mag.source === "mangaupdates" ? "confirmado via MangaUpdates" : "derivado dos dados da obra"}
        </span>
      </div>
      {mag.accepts?.length ? (
        <p className="mt-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">A revista aceita:</span> {mag.accepts.join(", ")}.
        </p>
      ) : null}
      {mag.famous?.length ? (
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          <span className="font-bold text-foreground">Também publicou:</span> {mag.famous.slice(0, 6).join(", ")}.
        </p>
      ) : null}
      <button
        onClick={() => openExplore({ mag: mag.name, q: "" })}
        className="mt-3 flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-bold text-primary transition hover:bg-primary/20"
      >
        <BookOpen className="h-3.5 w-3.5" /> Ver obras desta revista no catálogo
      </button>
    </div>
  );
}

function LibraryButtons({ workId }: { workId: string }) {
  const library = usePortal((s) => s.library);
  const upsertLocal = usePortal((s) => s.upsertLocal);
  const removeLocal = usePortal((s) => s.removeLocal);
  const go = usePortal((s) => s.go);
  const entry = library[workId];

  const add = (status: LibraryEntry["status"]) =>
    upsertLocal({ workId, status, rating: entry?.rating ?? null, note: entry?.note ?? null, updatedAt: new Date().toISOString() });

  if (!entry) {
    return (
      // mobile: 3 botões compactos em 1 linha (atalhos curtos); sm+: layout original
      <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:gap-2">
        <button onClick={() => add("plan")} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2 text-xs font-bold transition hover:border-primary/40 hover:bg-primary/5 sm:px-3.5 sm:text-sm">
          <BookPlus className="h-4 w-4 text-primary" /> <span className="sm:hidden">Quero</span><span className="hidden sm:inline">Quero ver/ler</span>
        </button>
        <button onClick={() => add("reading")} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2 text-xs font-bold transition hover:border-primary/40 hover:bg-primary/5 sm:px-3.5 sm:text-sm">
          <LibIcon className="h-4 w-4 text-primary" /> <span className="sm:hidden">Lendo</span><span className="hidden sm:inline">Estou lendo/assistindo</span>
        </button>
        <button onClick={() => add("favorite")} className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-2 py-2 text-xs font-bold transition hover:border-pink-400/40 hover:bg-pink-500/5 sm:px-3.5 sm:text-sm">
          <Heart className="h-4 w-4 text-pink-500" /> Favorito
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-sm font-bold text-emerald-600 dark:text-emerald-300">
        <BookmarkCheck className="h-4 w-4" /> {LIB_STATUS_LABEL[entry.status]}
        {entry.rating != null && <span className="ml-1">· ⭐ {entry.rating}/10</span>}
      </span>
      <button onClick={() => go("library")} className="text-xs font-bold text-primary underline-offset-2 hover:underline">gerenciar na biblioteca</button>
      <button onClick={() => removeLocal(workId)} className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline">remover</button>
    </div>
  );
}

const LINK_TYPE_LABEL: Record<string, string> = {
  STREAMING: "Onde assistir",
  OFFICIAL: "Oficial",
  INFORMATION: "Info/Comunidade",
  SOCIAL: "Social",
  BUY: "Onde comprar",
  OTHER: "Outros",
};

export function DetailView({ workId }: { workId: string }) {
  const go = usePortal((s) => s.go);
  const openExplore = usePortal((s) => s.openExplore);
  const [data, setData] = useState<DetailPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imgStage, setImgStage] = useState(0);

  // reset derivado em render (padrão oficial React) — troca de obra limpa o estado
  const [prevId, setPrevId] = useState(workId);
  if (prevId !== workId) {
    setPrevId(workId);
    setData(null);
    setError(null);
    setImgStage(0);
  }

  useEffect(() => {
    let alive = true;
    // consome o pipeline de prefetch: se o card já começou o fetch no hover/toque,
    // reaproveita o MESMO promise — abrir fica instantâneo; senão, busca agora.
    prefetchWork(workId).then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setError(res.data?.error ?? (res.status === 404 ? "Obra não encontrada" : res.status === 403 ? res.data?.error ?? "Conteúdo bloqueado" : "Erro de conexão"));
    });
    return () => {
      alive = false;
    };
  }, [workId]);

  if (error) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
        {error.includes("+18") || error.includes("adult") ? (
          <ShieldAlert className="h-10 w-10 text-destructive" />
        ) : (
          <Loader2 className="h-8 w-8 text-muted-foreground" />
        )}
        <p className="font-bold">{error}</p>
        <button onClick={() => go("home")} className="text-sm font-bold text-primary hover:underline">← voltar ao início</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Abrindo a obra...</p>
      </div>
    );
  }

  const w = data.work;
  const langs = getLanguages(w);
  const next = getNextRelease(w);
  const names = altNames(w);
  const authors = mainAuthors(w);
  const mag = w.magazine ?? null;
  // v4.0: direto primeiro; proxy /api/img é só o fallback anti-hotlink
  const proxy = proxyImg(w.cover, w.coverAlt);

  return (
    <div className="flex flex-col gap-5">
      <button onClick={() => (window.history.length > 1 ? window.history.back() : go("home"))} className="flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> voltar
      </button>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-border">
        <div className="absolute inset-0">
          {imgStage < 3 && (w.banner || w.cover || w.coverAlt) ? (
            <img
              src={
                imgStage === 0
                  ? (w.banner ?? w.cover ?? w.coverAlt ?? "")
                  : imgStage === 1
                    ? (w.coverAlt ?? w.cover ?? w.banner ?? "")
                    : (proxy ?? "")
              }
              alt=""
              referrerPolicy="no-referrer"
              decoding="async"
              onError={() => setImgStage((s) => s + 1)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full" style={{ background: w.coverColor ? `linear-gradient(140deg, ${w.coverColor}, ${w.coverColor}66)` : "var(--ov-hero)" }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-background/30" />
        </div>

        <div className="relative z-10 flex flex-col gap-5 p-5 pt-8 sm:flex-row sm:p-7">
          {/* capa */}
          <div className="w-36 shrink-0 self-start sm:w-48">
            <div className="ov-shadow overflow-hidden rounded-2xl border border-border" style={{ background: w.coverColor ? `${w.coverColor}22` : "var(--muted)" }}>
              {imgStage < 3 && (w.cover || w.coverAlt) ? (
                <img
                  src={
                    imgStage === 0
                      ? (w.cover ?? w.coverAlt ?? "")
                      : imgStage === 1
                        ? (w.coverAlt ?? w.cover ?? "")
                        : (proxy ?? "")
                  }
                  alt={`Capa de ${w.title}`}
                  referrerPolicy="no-referrer"
                  decoding="async"
                  fetchPriority="high"
                  onError={() => setImgStage((s) => s + 1)}
                  className="aspect-[2/3] w-full object-cover"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center p-4 text-center" style={{ background: w.coverColor ? `linear-gradient(150deg, ${w.coverColor}cc, ${w.coverColor}55)` : "var(--accent)" }}>
                  <span className="text-sm font-black leading-tight" style={{ color: w.coverColor ? "#fff" : "var(--foreground)" }}>{w.title}</span>
                </div>
              )}
            </div>
          </div>

          {/* info principal */}
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <span className="bg-brand-gradient rounded-lg px-2.5 py-1 text-[11px] font-black uppercase text-white">{TYPE_LABEL[w.type]}</span>
              {w.classification === "suggestive" && (
                <span className="rounded-lg bg-pink-600/15 px-2.5 py-1 text-[11px] font-black uppercase text-pink-600 ring-1 ring-pink-500/30 dark:text-pink-300">Ecchi</span>
              )}
              {w.status && <span className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-bold">{STATUS_LABEL[w.status] ?? w.status}</span>}
              {w.country && <span className="rounded-lg bg-secondary px-2.5 py-1 text-[11px] font-bold">{COUNTRY_FLAG[w.country] ?? ""} {w.country}</span>}
            </div>

            {/* NOME ORIGINAL preservado */}
            <h1 className="text-2xl font-black leading-tight sm:text-3xl">{w.title}</h1>
            {(w.titleNative && w.titleNative !== w.title) && (
              <p className="mt-1 text-sm font-semibold text-muted-foreground">{w.titleNative}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-2">
              <LibraryButtons workId={w.id} />
            </div>

            {/* próximo lançamento */}
            {next && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5 text-sm">
                <CalendarDays className="h-4 w-4 text-primary" />
                <span className="font-bold">{next.label}</span>
                {next.detail && <span className="text-xs text-muted-foreground">— {next.detail}</span>}
              </div>
            )}

            {/* idiomas */}
            {langs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {langs.slice(0, 6).map((l) => <LangChip key={l.code} l={l} />)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <StatBox icon={<Star className="h-3.5 w-3.5" />} label="Nota média" value={`${w.avgScore ?? "—"}%`} hint="média da comunidade global" />
        <StatBox icon={<Users className="h-3.5 w-3.5" />} label="Popularidade" value={fmtNum(w.popularity)} hint="pessoas com na lista" />
        <StatBox icon={<Heart className="h-3.5 w-3.5" />} label="Favoritos" value={fmtNum(w.favourites)} hint="marcações de favorito" />
        <StatBox icon={w.type === "anime" || w.type === "drama" ? <Tv className="h-3.5 w-3.5" /> : <Layers className="h-3.5 w-3.5" />} label={w.type === "anime" || w.type === "drama" ? "Episódios" : "Capítulos"} value={String(w.type === "anime" || w.type === "drama" ? w.episodes ?? "—" : w.chapters ?? "—")} hint={w.volumes ? `${w.volumes} volumes` : undefined} />
        <StatBox icon={<CalendarDays className="h-3.5 w-3.5" />} label="Início" value={fmtDate(w.startDate)} hint={w.endDate ? `fim: ${fmtDate(w.endDate)}` : undefined} />
        <StatBox icon={<BookOpen className="h-3.5 w-3.5" />} label="Formato" value={w.format ?? "—"} hint={w.duration ? `${w.duration} min` : undefined} />
      </section>

      {/* ABAS */}
      <Tabs defaultValue="visao">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-secondary/60 p-1">
          <TabsTrigger value="visao" className="data-[state=active]:bg-card data-[state=active]:text-primary">Visão geral</TabsTrigger>
          <TabsTrigger value="links" className="data-[state=active]:bg-card data-[state=active]:text-primary">Onde ler & links</TabsTrigger>
          <TabsTrigger value="relacionados" className="data-[state=active]:bg-card data-[state=active]:text-primary">Parecidas & autor</TabsTrigger>
          <TabsTrigger value="ia" className="data-[state=active]:bg-card data-[state=active]:text-primary">Análise da Aoi</TabsTrigger>
        </TabsList>

        {/* ABA VISÃO GERAL */}
        <TabsContent value="visao" className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            {/* nomes alternativos */}
            {names.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-black"><ListTree className="h-4 w-4 text-primary" /> Também conhecida como</p>
                <div className="flex flex-wrap gap-1.5">
                  {names.map((n, i) => (
                    <span key={i} className="rounded-lg border border-border bg-secondary px-2.5 py-1 text-xs">
                      <span className="mr-1 text-[10px] font-bold uppercase text-muted-foreground">{n.label}:</span>
                      <span className="font-semibold">{n.value}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Os nomes originais nunca são traduzidos — estes são os títulos oficiais usados em cada região.</p>
              </div>
            )}

            {/* revista/editora */}
            {mag && <MagazineCard mag={mag} network={w.network} />}

            {/* sinopse (com tradução PT sob demanda) */}
            <SynopsisBlock work={w} />

            {/* gêneros + tags */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-black"><Tags className="h-4 w-4 text-primary" /> Gêneros & tags</p>
              <div className="mb-2.5 flex flex-wrap gap-1.5">
                {w.genres.map((g) => (
                  <button key={g} onClick={() => openExplore({ genre: g, tag: "all" })} className="bg-brand-gradient rounded-lg px-2.5 py-1 text-[11px] font-bold text-white transition hover:brightness-110">
                    {g}
                  </button>
                ))}
              </div>
              <TagChips work={w} />
            </div>
          </div>

          {/* coluna lateral: autoria e links rápidos */}
          <div className="flex flex-col gap-4">
            {authors.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-black"><User className="h-4 w-4 text-primary" /> Autoria</p>
                <div className="flex flex-col gap-2">
                  {authors.slice(0, 5).map((a, i) => (
                    <button key={i} onClick={() => openExplore({ q: a.name })} className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2 text-left text-xs transition hover:bg-accent">
                      <span className="font-bold">{a.name}</span>
                      <span className="text-[10px] text-muted-foreground">{a.role}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-black"><Globe className="h-4 w-4 text-primary" /> Fonte & radar</p>
              <div className="flex flex-col gap-1.5 text-xs">
                {w.siteUrl && (
                  <a href={w.siteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-bold text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> Página na fonte do dado (AniList)
                  </a>
                )}
                {w.malId && (
                  <a href={`https://myanimelist.net/${w.type === "anime" ? "anime" : "manga"}/${w.malId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-bold text-primary hover:underline">
                    <Newspaper className="h-3.5 w-3.5" /> Ver no MyAnimeList
                  </a>
                )}
                <a href={`https://x.com/search?q=${encodeURIComponent(w.title)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-bold text-primary hover:underline">
                  <Sparkles className="h-3.5 w-3.5" /> Discussões no X/Twitter
                </a>
                <a href={`https://www.google.com/search?q=${encodeURIComponent(w.title + " manga news")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-bold text-primary hover:underline">
                  <Newspaper className="h-3.5 w-3.5" /> Notícias & lançamentos no Google
                </a>
              </div>
            </div>
            {/* Afiliados por país — some sozinho em obras adultas (linha vermelha interna) */}
            <BuyPanel work={w} />
            {/* Anúncio — SÓ obras safe (o AdSlot bloqueia suggestive/adult/+18) */}
            <AdSlot slotId="detail-sidebar" workClass={w.classification} />
          </div>
        </TabsContent>

        {/* ABA LINKS */}
        <TabsContent value="links" className="mt-4 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">Portais oficiais para ler/assistir legalmente, comunidades onde a obra é discutida e radar externo para acompanhar notícias.</p>
          {w.extLinks.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {w.extLinks.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center justify-between gap-2 rounded-xl border border-border bg-card p-3.5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{l.site}</p>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {LINK_TYPE_LABEL[l.type ?? ""] ?? "Link"}{l.language ? ` · ${l.language}` : ""}
                    </p>
                  </div>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: (l.color ?? "#2563eb") + "22", color: l.color ?? "#2563eb" }}>
                    <ExternalLink className="h-4 w-4" />
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Sem links oficiais cadastrados na fonte para esta obra — use o radar externo abaixo.
            </div>
          )}

          {/* radar externo */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="mb-1 flex items-center gap-2 text-sm font-black"><Globe className="h-4 w-4 text-primary" /> Radar externo</p>
            <p className="mb-3 text-[11px] text-muted-foreground">Acompanhe esta obra fora do OtakuVerse — atualizações, discussões e notícias.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {w.malId && (
                <a href={`https://myanimelist.net/${w.type === "anime" ? "anime" : "manga"}/${w.malId}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                  <span className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-[#2e51a2]" /> MyAnimeList</span>
                  <span className="text-[10px] font-semibold text-muted-foreground">score e comunidade</span>
                </a>
              )}
              <a href="https://www.mangaupdates.com/series.html?search=" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                <span className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-[#5a2d82]" /> MangaUpdates</span>
                <span className="text-[10px] font-semibold text-muted-foreground">licenças e lançamentos</span>
              </a>
              <a href={`https://x.com/search?q=${encodeURIComponent(w.title)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                <span className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-foreground" /> X / Twitter</span>
                <span className="text-[10px] font-semibold text-muted-foreground">discussões em tempo real</span>
              </a>
              <a href={`https://www.google.com/search?q=${encodeURIComponent(w.title + " manga anime news")}&tbm=nws`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                <span className="flex items-center gap-2"><Newspaper className="h-4 w-4 text-[#d93025]" /> Google Notícias</span>
                <span className="text-[10px] font-semibold text-muted-foreground">últimas notícias</span>
              </a>
              <a href={`https://anilist.co/search/${w.type === "anime" ? "anime" : "manga"}?q=${encodeURIComponent(w.title)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                <span className="flex items-center gap-2"><Star className="h-4 w-4 text-[#02a9ff]" /> AniList</span>
                <span className="text-[10px] font-semibold text-muted-foreground">ficha completa</span>
              </a>
              <a href={`https://mangadex.org/search?q=${encodeURIComponent(w.title)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between rounded-xl bg-secondary px-3.5 py-2.5 text-xs font-bold transition hover:bg-accent">
                <span className="flex items-center gap-2"><Layers className="h-4 w-4 text-[#f97316]" /> MangaDex</span>
                <span className="text-[10px] font-semibold text-muted-foreground">capítulos e grupos</span>
              </a>
            </div>
          </div>
        </TabsContent>

        {/* ABA RELACIONADOS */}
        <TabsContent value="relacionados" className="mt-4 flex flex-col gap-6">
          {data.related.similar.length > 0 && (
            <section>
              <p className="mb-2.5 text-sm font-black">Parecidas (mesmo clima e temas)</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {data.related.similar.map((x) => <WorkCard key={x.id} work={x} />)}
              </div>
            </section>
          )}
          {data.related.also.length > 0 && (
            <section>
              <p className="mb-2.5 text-sm font-black">Também combinam</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {data.related.also.map((x) => <WorkCard key={x.id} work={x} />)}
              </div>
            </section>
          )}
          {data.related.byAuthor.map(({ author, works }) => (
            <section key={author}>
              <p className="mb-2.5 flex items-center gap-2 text-sm font-black"><User className="h-4 w-4 text-primary" /> Mais de {author}</p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {works.slice(0, 12).map((x) => <WorkCard key={x.id} work={x} />)}
              </div>
            </section>
          ))}
        </TabsContent>

        {/* ABA IA */}
        <TabsContent value="ia" className="mt-4">
          <AoiAnalysis work={w} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AoiAnalysis({ work }: { work: WorkData }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // reset derivado em render ao trocar de obra
  const [prevWork, setPrevWork] = useState(work.id);
  if (prevWork !== work.id) {
    setPrevWork(work.id);
    setText(null);
    setLoading(true);
  }

  useEffect(() => {
    let alive = true;
    // payload mínimo: só o id — o servidor resolve a obra pelo cache (200x menor)
    fetch("/api/ai/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: work.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (alive) setText(d.ok ? d.analysis : "A Aoi não conseguiu analisar agora. Tente de novo em instantes.");
      })
      .catch(() => {
        if (alive) setText("Falha de conexão com a Aoi.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [work.id]);

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="bg-brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-lg">🌸</span>
        <div>
          <p className="text-sm font-black">Análise da Aoi-chan</p>
          <p className="text-[11px] text-muted-foreground">perfil, clima, hits e para quem essa obra é — na voz da sua waifu curadora</p>
        </div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A Aoi está lendo a obra...
        </div>
      ) : (
        <div className="text-sm leading-relaxed text-foreground/90">
          <AoiMarkdown content={text ?? ""} />
        </div>
      )}
    </div>
  );
}
