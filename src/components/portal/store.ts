"use client";

import { create } from "zustand";

export type View =
  | "home" | "explore" | "detail" | "assistant" | "calendar" | "news"
  | "library" | "profile" | "auth" | "adult" | "legal" | "sales" | "magazines";

export interface ExploreFilters {
  q: string;
  type: string; // all | manga | manhwa | manhua | lightnovel | anime | drama
  genre: string;
  tag: string;
  status: string;
  sort: string;
  classification: string; // all | safe | suggestive
  lang: string; // all | JA | KO | ZH | EN | PT-BR
  mag: string; // all | nome da revista
}

export const DEFAULT_FILTERS: ExploreFilters = {
  q: "", type: "all", genre: "all", tag: "all", status: "all", sort: "popular", classification: "all", lang: "all", mag: "all",
};

export interface SessionUser {
  id: string;
  email: string;
  username: string;
  displayName?: string | null;
  avatarColor?: string | null;
  bio?: string | null;
  adultMode: boolean;
  settings?: string | null;
}

export interface LibraryEntry {
  workId: string;
  status: "reading" | "completed" | "plan" | "paused" | "dropped" | "favorite";
  rating?: number | null;
  note?: string | null;
  updatedAt: string;
}

export const LIB_STATUS_LABEL: Record<LibraryEntry["status"], string> = {
  reading: "Lendo/Assistindo",
  completed: "Concluído",
  plan: "Planejo ver/ler",
  paused: "Em pausa",
  dropped: "Abandonei",
  favorite: "Favorito ♥",
};

export const THEMES: { id: string; name: string; dot: string }[] = [
  { id: "azul", name: "Azul-branco (padrão)", dot: "#2563eb" },
  { id: "noite", name: "Noite azul", dot: "#1e3a8a" },
  { id: "sakura", name: "Sakura", dot: "#db2777" },
  { id: "esmeralda", name: "Esmeralda", dot: "#059669" },
  { id: "violeta", name: "Meia-noite violeta", dot: "#8b5cf6" },
  { id: "cafe", name: "Café & creme", dot: "#92400e" },
  { id: "neon", name: "Neon cyber", dot: "#06b6d4" },
];

export const HYPE_MODES: { id: string; name: string; desc: string }[] = [
  { id: "hype", name: "Hype do momento", desc: "O que o mundo otaku está comentando AGORA (tendência real)" },
  { id: "score", name: "Melhores notas", desc: "Os mais bem avaliados de todos os tempos" },
  { id: "new", name: "Novidades quentes", desc: "Estreias recentes que bombaram" },
  { id: "classic", name: "Clássicos atemporais", desc: "Os mais favoritados da história" },
];

interface PortalState {
  view: View;
  workId: string | null;
  legalTab: string;
  filters: ExploreFilters;
  theme: string;
  hypeMode: string;
  user: SessionUser | null;
  authChecked: boolean;
  library: Record<string, LibraryEntry>;
  syncState: "idle" | "syncing" | "ok" | "error";
  lastSync: string | null;
  go: (view: View) => void;
  openWork: (id: string) => void;
  openExplore: (partial?: Partial<ExploreFilters>) => void;
  setFilters: (partial: Partial<ExploreFilters>) => void;
  setTheme: (t: string) => void;
  setHypeMode: (m: string) => void;
  setUser: (u: SessionUser | null) => void;
  setLibrary: (l: Record<string, LibraryEntry>) => void;
  upsertLocal: (e: LibraryEntry) => void;
  removeLocal: (workId: string) => void;
  setSync: (s: PortalState["syncState"], at?: string | null) => void;
  refreshAuth: () => Promise<void>;
  syncCloud: (direction: "push" | "pull") => Promise<void>;
}

// ---------- persistência local (espelho da nuvem + preferências) ----------
const LS_THEME = "ov_theme";
const LS_LIB = "ov_library_v2";
const LS_HYPE = "ov_hype_mode";

function readLocalLib(): Record<string, LibraryEntry> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_LIB) ?? "{}");
  } catch {
    return {};
  }
}
function writeLocalLib(lib: Record<string, LibraryEntry>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_LIB, JSON.stringify(lib));
  } catch {}
}

function hashFor(state: { view: View; workId: string | null; filters?: ExploreFilters; legalTab?: string }): string {
  switch (state.view) {
    case "home": return "#/";
    case "explore": {
      const p = new URLSearchParams();
      const f = state.filters;
      if (f) {
        if (f.q) p.set("q", f.q);
        if (f.type !== "all") p.set("type", f.type);
        if (f.genre !== "all") p.set("genre", f.genre);
        if (f.tag !== "all") p.set("tag", f.tag);
        if (f.status !== "all") p.set("status", f.status);
        if (f.sort !== "popular") p.set("sort", f.sort);
        if (f.classification !== "all") p.set("classification", f.classification);
        if (f.lang !== "all") p.set("lang", f.lang);
        if (f.mag !== "all") p.set("mag", f.mag);
      }
      const qs = p.toString();
      return `#/explorar${qs ? "?" + qs : ""}`;
    }
    case "detail": return `#/obra/${state.workId ?? ""}`;
    case "assistant": return "#/assistente";
    case "calendar": return "#/calendario";
    case "news": return "#/noticias";
    case "sales": return "#/vendas";
    case "magazines": return "#/revistas";
    case "library": return "#/biblioteca";
    case "profile": return "#/perfil";
    case "auth": return "#/conta";
    case "adult": return "#/zona-adulta";
    case "legal": return `#/legal/${state.legalTab ?? "termos"}`;
  }
}

function parseHash(): { view: View; workId: string | null; filters?: Partial<ExploreFilters>; legalTab?: string } {
  const h = typeof window === "undefined" ? "" : window.location.hash;
  if (h.startsWith("#/obra/")) {
    const id = h.slice("#/obra/".length).split(/[/?]/)[0];
    if (id) return { view: "detail", workId: id };
  }
  if (h.startsWith("#/explorar")) {
    const p = new URLSearchParams(h.split("?")[1] ?? "");
    return {
      view: "explore", workId: null,
      filters: {
        q: p.get("q") ?? "", type: p.get("type") ?? "all", genre: p.get("genre") ?? "all",
        tag: p.get("tag") ?? "all", status: p.get("status") ?? "all", sort: p.get("sort") ?? "popular",
        classification: p.get("classification") ?? "all", lang: p.get("lang") ?? "all", mag: p.get("mag") ?? "all",
      },
    };
  }
  if (h.startsWith("#/assistente")) return { view: "assistant", workId: null };
  if (h.startsWith("#/calendario")) return { view: "calendar", workId: null };
  if (h.startsWith("#/noticias")) return { view: "news", workId: null };
  if (h.startsWith("#/vendas")) return { view: "sales", workId: null };
  if (h.startsWith("#/revistas")) return { view: "magazines", workId: null };
  if (h.startsWith("#/biblioteca")) return { view: "library", workId: null };
  if (h.startsWith("#/perfil")) return { view: "profile", workId: null };
  if (h.startsWith("#/conta")) return { view: "auth", workId: null };
  if (h.startsWith("#/zona-adulta")) return { view: "adult", workId: null };
  if (h.startsWith("#/legal/")) {
    const tab = h.slice("#/legal/".length).split(/[/?]/)[0] || "termos";
    return { view: "legal", workId: null, legalTab: tab };
  }
  return { view: "home", workId: null };
}

export const usePortal = create<PortalState>((set, get) => ({
  view: "home",
  workId: null,
  legalTab: "termos",
  filters: { ...DEFAULT_FILTERS },
  theme: "azul",
  hypeMode: "hype",
  user: null,
  authChecked: false,
  library: {},
  syncState: "idle",
  lastSync: null,

  go: (view) => {
    const h = hashFor({ view, workId: null, filters: get().filters, legalTab: view === "legal" ? get().legalTab : undefined });
    if (typeof window !== "undefined") window.location.hash = h;
    set({ view, workId: null });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  openWork: (id) => {
    if (typeof window !== "undefined") window.location.hash = hashFor({ view: "detail", workId: id });
    set({ view: "detail", workId: id });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  openExplore: (partial) => {
    const filters = { ...get().filters, ...(partial ?? {}) };
    set({ filters, view: "explore", workId: null });
    if (typeof window !== "undefined") {
      window.location.hash = hashFor({ view: "explore", workId: null, filters });
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  setFilters: (partial) => {
    const filters = { ...get().filters, ...partial };
    set({ filters });
    if (typeof window !== "undefined" && get().view === "explore") {
      window.history.replaceState(null, "", hashFor({ view: "explore", workId: null, filters }));
    }
  },
  setTheme: (t) => {
    set({ theme: t });
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-ov-theme", t);
      localStorage.setItem(LS_THEME, t);
    }
  },
  setHypeMode: (m) => {
    set({ hypeMode: m });
    if (typeof window !== "undefined") localStorage.setItem(LS_HYPE, m);
  },
  setUser: (u) => {
    set({ user: u, authChecked: true });
    if (typeof window !== "undefined") {
      // sinaliza modo adulto para o CSS (esconder exibos/links da zona adulta)
      document.documentElement.setAttribute("data-ov-adult", u?.adultMode ? "on" : "off");
    }
  },
  setLibrary: (lib) => {
    set({ library: lib });
    writeLocalLib(lib);
  },
  upsertLocal: (e) => {
    const lib = { ...get().library, [e.workId]: e };
    set({ library: lib });
    writeLocalLib(lib);
    get().syncCloud("push");
  },
  removeLocal: (workId) => {
    const lib = { ...get().library };
    delete lib[workId];
    set({ library: lib });
    writeLocalLib(lib);
    if (get().user) {
      fetch(`/api/library?workId=${encodeURIComponent(workId)}`, { method: "DELETE" }).catch(() => {});
    }
  },
  setSync: (s, at) => set({ syncState: s, ...(at ? { lastSync: at } : {}) }),

  async refreshAuth() {
    try {
      const r = await fetch("/api/auth/me");
      const d = await r.json();
      if (d.ok && d.user) {
        get().setUser(d.user);
        // puxa nuvem: biblioteca do servidor sobrepõe espelho local
        await get().syncCloud("pull");
      } else {
        get().setUser(null);
      }
    } catch {
      get().setUser(null);
    } finally {
      if (!get().authChecked) set({ authChecked: true });
    }
  },

  async syncCloud(direction) {
    if (!get().user) return;
    set({ syncState: "syncing" });
    try {
      if (direction === "push") {
        const lib = get().library;
        const items = Object.values(lib);
        if (items.length) {
          await fetch("/api/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items }),
          });
        }
        set({ syncState: "ok", lastSync: new Date().toISOString() });
      } else {
        const r = await fetch("/api/library");
        const d = await r.json();
        if (d.ok) {
          const local = readLocalLib();
          const merged: Record<string, LibraryEntry> = { ...local };
          for (const it of d.items as LibraryEntry[]) {
            const l = local[it.workId];
            // last-write-wins
            if (!l || new Date(it.updatedAt) > new Date(l.updatedAt)) merged[it.workId] = it;
          }
          get().setLibrary(merged);
          set({ syncState: "ok", lastSync: d.syncedAt ?? new Date().toISOString() });
        } else {
          set({ syncState: "error" });
        }
      }
    } catch {
      set({ syncState: "error" });
    }
  },
}));

/** Sincroniza navegação com botões voltar/avançar */
export function bindHashSync() {
  const handler = () => {
    const parsed = parseHash();
    const st = usePortal.getState();
    if (parsed.view === "detail" && parsed.workId === st.workId && st.view === "detail") return;
    if (parsed.view === st.view && parsed.view !== "explore" && parsed.view !== "legal") return;
    usePortal.setState({
      view: parsed.view,
      workId: parsed.workId,
      filters: { ...st.filters, ...(parsed.filters ?? {}) },
      ...(parsed.legalTab ? { legalTab: parsed.legalTab } : {}),
    });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }
  return () => {};
}
