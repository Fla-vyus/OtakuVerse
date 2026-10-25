"use client";

import { useEffect, useState } from "react";
import { Home, Compass, Sparkles, Search, MoonStar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePortal, bindHashSync, type View } from "./store";
import { HomeView } from "./HomeView";
import { ExploreView } from "./ExploreView";
import { DetailView } from "./DetailView";
import { AssistantView } from "./AssistantView";
import type { WorkData } from "@/lib/types";

function Logo() {
  const go = usePortal((s) => s.go);
  return (
    <button onClick={() => go("home")} className="group flex items-center gap-2.5" aria-label="OtakuVerse — início">
      <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg shadow-violet-950/40 transition group-hover:scale-105">
        <MoonStar className="h-5 w-5" />
      </span>
      <span className="text-lg font-black tracking-tight">
        Otaku<span className="text-gradient">Verse</span>
      </span>
    </button>
  );
}

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "Início", icon: <Home className="h-4 w-4" /> },
  { view: "explore", label: "Explorar", icon: <Compass className="h-4 w-4" /> },
  { view: "assistant", label: "Assistente IA", icon: <Sparkles className="h-4 w-4" /> },
];

export function PortalApp() {
  const view = usePortal((s) => s.view);
  const workId = usePortal((s) => s.workId);
  const go = usePortal((s) => s.go);
  const openExplore = usePortal((s) => s.openExplore);
  const [all, setAll] = useState<WorkData[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unbind = bindHashSync();
    const parsed = (() => {
      const h = window.location.hash;
      if (h.startsWith("#/obra/")) return { view: "detail" as View, workId: h.slice(7).split(/[/?]/)[0] };
      if (h.startsWith("#/explorar")) return { view: "explore" as View, workId: null };
      if (h.startsWith("#/assistente")) return { view: "assistant" as View, workId: null };
      return { view: "home" as View, workId: null };
    })();
    if (parsed.view !== "home") usePortal.setState(parsed);
    return unbind;
  }, []);

  useEffect(() => {
    fetch("/api/works?perPage=999&sort=popular")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setAll(d.items);
      })
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-white/8">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => go(n.view)}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  view === n.view
                    ? "bg-primary/15 text-violet-200 ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
                aria-current={view === n.view ? "page" : undefined}
              >
                {n.icon} {n.label}
              </button>
            ))}
          </nav>
          <form
            className="relative hidden w-56 lg:block"
            onSubmit={(e) => {
              e.preventDefault();
              openExplore({ q: search });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar obras..."
              className="border-white/10 bg-secondary/50 pl-9 text-sm"
              aria-label="Buscar"
            />
          </form>
          <button
            onClick={() => go("assistant")}
            className="bg-brand-gradient flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white shadow-lg shadow-violet-950/40 transition hover:brightness-110 md:hidden"
            aria-label="Abrir assistente IA"
          >
            <Sparkles className="h-4 w-4" /> IA
          </button>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 md:pb-10">
        {view === "home" && <HomeView all={all} loading={loadingAll} />}
        {view === "explore" && <ExploreView />}
        {view === "detail" && workId && <DetailView workId={workId} />}
        {view === "assistant" && <AssistantView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/8 bg-card/40">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
            <div className="flex items-center gap-2.5">
              <span className="bg-brand-gradient flex h-8 w-8 items-center justify-center rounded-lg text-white">
                <MoonStar className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">OtakuVerse</p>
                <p className="text-[11px] text-muted-foreground">seu garimpo de mangás, manhwas, LNs e animes com curadoria de IA</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>Dados e imagens: <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">AniList</a> / <a href="https://myanimelist.net" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">MyAnimeList</a></span>
              <span>© {new Date().getFullYear()} · Direitos das obras pertencem aos autores e editoras</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Nav mobile */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-white/8 pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Navegação mobile">
        <div className="grid grid-cols-3">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => go(n.view)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
                view === n.view ? "text-violet-300" : "text-muted-foreground"
              }`}
              aria-current={view === n.view ? "page" : undefined}
            >
              {n.icon}
              {n.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
