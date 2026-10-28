"use client";

import { useEffect, useState } from "react";
import {
  Home, Compass, Sparkles, Search, MoonStar, CalendarDays, Newspaper,
  Library, Palette, User, LogIn, LogOut, ShieldAlert, Loader2, CloudCheck, CloudOff,
  TrendingUp, BookMarked, MonitorPlay,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePortal, bindHashSync, bindPendingSyncRetry, THEMES, type View } from "./store";
import { HomeView } from "./HomeView";
import { ExploreView } from "./ExploreView";
import { DetailView } from "./DetailView";
import { AssistantView } from "./AssistantView";
import { CalendarView } from "./CalendarView";
import { NewsView } from "./NewsView";
import { LibraryView } from "./LibraryView";
import { ProfileView } from "./ProfileView";
import { AuthView } from "./AuthView";
import { AdultZoneView } from "./AdultZoneView";
import { LegalView } from "./LegalView";
import { SalesView } from "./SalesView";
import { MagazinesView } from "./MagazinesView";
import { StreamingView } from "./StreamingView";

function Logo() {
  const go = usePortal((s) => s.go);
  return (
    <button onClick={() => go("home")} className="group flex items-center gap-2.5" aria-label="OtakuVerse — início">
      <span className="bg-brand-gradient flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-lg shadow-blue-900/30 transition group-hover:scale-105">
        <MoonStar className="h-5 w-5" />
      </span>
      <span className="text-lg font-black tracking-tight">
        Otaku<span className="text-gradient">Verse</span>
      </span>
    </button>
  );
}

function ThemeSwitcher() {
  const theme = usePortal((s) => s.theme);
  const setTheme = usePortal((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-accent"
        aria-label="Trocar tema"
        title="Trocar tema"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
          <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Aparência</p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-accent ${theme === t.id ? "font-bold text-primary" : ""}`}
            >
              <span className="h-4 w-4 rounded-full border border-black/10 shadow-inner" style={{ background: t.dot }} />
              {t.name}
              {theme === t.id && <span className="ml-auto text-xs">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const user = usePortal((s) => s.user);
  const authChecked = usePortal((s) => s.authChecked);
  const syncState = usePortal((s) => s.syncState);
  const go = usePortal((s) => s.go);
  const setUser = usePortal((s) => s.setUser);
  const setLibrary = usePortal((s) => s.setLibrary);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  if (!authChecked) {
    return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
  }

  if (!user) {
    return (
      <button
        onClick={() => go("auth")}
        className="bg-brand-gradient flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-110"
      >
        <LogIn className="h-4 w-4" /> <span className="hidden sm:inline">Entrar</span>
      </button>
    );
  }

  const initial = (user.displayName || user.username || "?")[0].toUpperCase();
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-2 rounded-xl border border-border bg-card px-2 transition hover:bg-accent"
        aria-label="Menu do usuário"
      >
        <span
          className="flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-black text-white"
          style={{ background: user.avatarColor ?? "#2563eb" }}
        >
          {initial}
        </span>
        <span className="hidden max-w-24 truncate text-sm font-semibold sm:inline">{user.displayName || user.username}</span>
        {syncState === "syncing" ? (
          <CloudCheck className="h-3.5 w-3.5 animate-pulse text-primary" />
        ) : syncState === "error" ? (
          <CloudOff className="h-3.5 w-3.5 text-destructive" />
        ) : (
          <CloudCheck className="h-3.5 w-3.5 text-emerald-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-56 rounded-xl border border-border bg-popover p-1.5 shadow-xl">
          <div className="border-b border-border px-3 pb-2 pt-1">
            <p className="truncate text-sm font-bold">{user.displayName || user.username}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
          </div>
          <button onClick={() => { go("profile"); setOpen(false); }} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent">
            <User className="h-4 w-4" /> Meu perfil & nuvem
          </button>
          <button onClick={() => { go("library"); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent">
            <Library className="h-4 w-4" /> Minha biblioteca
          </button>
          {user.adultMode && (
            <button onClick={() => { go("adult"); setOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-accent">
              <ShieldAlert className="h-4 w-4 text-red-500" /> Zona Adulta +18
            </button>
          )}
          <div className="my-1 border-t border-border" />
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              setUser(null);
              setLibrary({});
              go("home");
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      )}
    </div>
  );
}

const NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "Início", icon: <Home className="h-4 w-4" /> },
  { view: "explore", label: "Explorar", icon: <Compass className="h-4 w-4" /> },
  { view: "sales", label: "Vendas", icon: <TrendingUp className="h-4 w-4" /> },
  { view: "magazines", label: "Revistas", icon: <BookMarked className="h-4 w-4" /> },
  { view: "calendar", label: "Calendário", icon: <CalendarDays className="h-4 w-4" /> },
  { view: "streaming", label: "Streaming", icon: <MonitorPlay className="h-4 w-4" /> },
  { view: "news", label: "Notícias", icon: <Newspaper className="h-4 w-4" /> },
  { view: "library", label: "Biblioteca", icon: <Library className="h-4 w-4" /> },
  { view: "assistant", label: "Aoi", icon: <Sparkles className="h-4 w-4" /> },
];

const MOBILE_NAV: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "home", label: "Início", icon: <Home className="h-4 w-4" /> },
  { view: "explore", label: "Explorar", icon: <Compass className="h-4 w-4" /> },
  { view: "calendar", label: "Agenda", icon: <CalendarDays className="h-4 w-4" /> },
  { view: "library", label: "Biblioteca", icon: <Library className="h-4 w-4" /> },
  { view: "profile", label: "Perfil", icon: <User className="h-4 w-4" /> },
];

export function PortalApp() {
  const view = usePortal((s) => s.view);
  const workId = usePortal((s) => s.workId);
  const go = usePortal((s) => s.go);
  const openExplore = usePortal((s) => s.openExplore);
  const refreshAuth = usePortal((s) => s.refreshAuth);
  const setTheme = usePortal((s) => s.setTheme);
  const setHypeMode = usePortal((s) => s.setHypeMode);
  const setLibrary = usePortal((s) => s.setLibrary);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<{ total: number | null; lastRefreshAt: string | null } | null>(null);

  useEffect(() => {
    // tema + hypeMode salvos
    const savedTheme = localStorage.getItem("ov_theme");
    if (savedTheme) setTheme(savedTheme);
    const savedHype = localStorage.getItem("ov_hype_mode");
    if (savedHype) setHypeMode(savedHype);
    // biblioteca local (espelho/offline)
    try {
      const lib = JSON.parse(localStorage.getItem("ov_library_v2") ?? "{}");
      if (Object.keys(lib).length) setLibrary(lib);
    } catch {}
    const unbind = bindHashSync();
    const unbindRetry = bindPendingSyncRetry(); // push pendente sobe sozinho com rede de volta
    const parsed = (() => {
      const h = window.location.hash;
      if (h.startsWith("#/obra/")) return { view: "detail" as View, workId: h.slice(7).split(/[/?]/)[0] };
      if (h.startsWith("#/explorar")) return { view: "explore" as View, workId: null };
      if (h.startsWith("#/assistente")) return { view: "assistant" as View, workId: null };
      if (h.startsWith("#/calendario")) return { view: "calendar" as View, workId: null };
      if (h.startsWith("#/streaming")) return { view: "streaming" as View, workId: null };
      if (h.startsWith("#/noticias")) return { view: "news" as View, workId: null };
      if (h.startsWith("#/vendas")) return { view: "sales" as View, workId: null };
      if (h.startsWith("#/revistas")) return { view: "magazines" as View, workId: null };
      if (h.startsWith("#/biblioteca")) return { view: "library" as View, workId: null };
      if (h.startsWith("#/perfil")) return { view: "profile" as View, workId: null };
      if (h.startsWith("#/conta")) return { view: "auth" as View, workId: null };
      if (h.startsWith("#/zona-adulta")) return { view: "adult" as View, workId: null };
      if (h.startsWith("#/legal")) return { view: "legal" as View, workId: null };
      return { view: "home" as View, workId: null };
    })();
    if (parsed.view !== "home") usePortal.setState(parsed);
    refreshAuth();
    fetch("/api/status").then((r) => r.json()).then((d) => {
      if (d.ok) setStatus({ total: d.total, lastRefreshAt: d.lastRefreshAt });
    }).catch(() => {});
    return () => { unbind(); unbindRetry(); };
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navegação principal">
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => go(n.view)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  view === n.view ? "bg-primary/10 text-primary ring-1 ring-primary/25" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
                aria-current={view === n.view ? "page" : undefined}
              >
                {n.icon} {n.label}
              </button>
            ))}
          </nav>
          <form
            className="relative hidden w-52 xl:block"
            onSubmit={(e) => {
              e.preventDefault();
              openExplore({ q: search });
            }}
          >
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar entre milhares..."
              className="pl-9 text-sm"
              aria-label="Buscar"
            />
          </form>
          <div className="flex items-center gap-2">
            <button
              onClick={() => go("assistant")}
              className="bg-brand-gradient hidden h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-bold text-white shadow-md transition hover:brightness-110 md:flex"
            >
              <Sparkles className="h-4 w-4" /> Aoi
            </button>
            <ThemeSwitcher />
            <UserMenu />
          </div>
        </div>
        {/* nav secundária mobile */}
        <nav className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border px-3 py-1.5 lg:hidden" aria-label="Navegação mobile superior">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => go(n.view)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                view === n.view ? "bg-primary/10 text-primary ring-1 ring-primary/25" : "text-muted-foreground"
              }`}
            >
              {n.icon} {n.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 md:pb-10">
        {view === "home" && <HomeView />}
        {view === "explore" && <ExploreView />}
        {view === "detail" && workId && <DetailView workId={workId} />}
        {view === "assistant" && <AssistantView />}
        {view === "calendar" && <CalendarView />}
        {view === "streaming" && <StreamingView />}
        {view === "news" && <NewsView />}
        {view === "library" && <LibraryView />}
        {view === "profile" && <ProfileView />}
        {view === "auth" && <AuthView />}
        {view === "adult" && <AdultZoneView />}
        {view === "legal" && <LegalView />}
        {view === "sales" && <SalesView />}
        {view === "magazines" && <MagazinesView />}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border bg-card/60">
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="flex items-start gap-2.5">
              <span className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white">
                <MoonStar className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-bold">OtakuVerse</p>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Portal de descoberta de mangás, manhwas, manhuas, light novels e animes.
                  Catálogo real, atualização automática e nuvem pessoal.
                </p>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              <p className="mb-1.5 text-xs font-bold text-foreground">Institucional</p>
              <div className="flex flex-col gap-1">
                <button onClick={() => go("legal")} className="w-fit text-left underline-offset-2 hover:text-foreground hover:underline">Termos de Uso</button>
                <button onClick={() => { usePortal.setState({ legalTab: "privacidade" }); go("legal"); }} className="w-fit text-left underline-offset-2 hover:text-foreground hover:underline">Política de Privacidade</button>
                <button onClick={() => { usePortal.setState({ legalTab: "regras" }); go("legal"); }} className="w-fit text-left underline-offset-2 hover:text-foreground hover:underline">Regras & Conteúdo +18</button>
              </div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              <p className="mb-1.5 text-xs font-bold text-foreground">Fontes de dados (com gratidão)</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <a href="https://anilist.co" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">AniList</a>
                <a href="https://kitsu.app" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">Kitsu</a>
                <a href="https://www.mangaupdates.com" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">MangaUpdates</a>
                <a href="https://pt.wikipedia.org" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:text-foreground hover:underline">Wikipédia</a>
              </div>
              <p className="mt-2 leading-relaxed">© {new Date().getFullYear()} OtakuVerse · Direitos das obras pertencem aos autores e editoras. Site informativo — não hospedamos conteúdo.</p>
              {status && (
                <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
                  <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Catálogo: {status.total != null ? status.total.toLocaleString("pt-BR") : "..."} obras · atualização automática ativa{status.lastRefreshAt ? ` · última varredura ${new Date(status.lastRefreshAt).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Nav mobile inferior */}
      <nav className="glass fixed inset-x-0 bottom-0 z-50 border-t border-border pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Navegação mobile">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => go(n.view)}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition ${
                view === n.view ? "text-primary" : "text-muted-foreground"
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
