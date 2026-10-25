"use client";

import { create } from "zustand";

export type View = "home" | "explore" | "detail" | "assistant";

export interface ExploreFilters {
  q: string;
  type: string; // all | manga | manhwa | manhua | lightnovel | anime
  genre: string;
  tag: string;
  status: string;
  sort: string;
}

export const DEFAULT_FILTERS: ExploreFilters = {
  q: "",
  type: "all",
  genre: "all",
  tag: "all",
  status: "all",
  sort: "popular",
};

interface PortalState {
  view: View;
  workId: string | null;
  filters: ExploreFilters;
  headerSearch: string;
  go: (view: View) => void;
  openWork: (id: string) => void;
  openExplore: (partial?: Partial<ExploreFilters>) => void;
  setFilters: (partial: Partial<ExploreFilters>) => void;
  setHeaderSearch: (v: string) => void;
}

function hashFor(view: View, workId: string | null, filters?: ExploreFilters): string {
  switch (view) {
    case "home": return "#/";
    case "explore": {
      const p = new URLSearchParams();
      if (filters) {
        if (filters.q) p.set("q", filters.q);
        if (filters.type !== "all") p.set("type", filters.type);
        if (filters.genre !== "all") p.set("genre", filters.genre);
        if (filters.tag !== "all") p.set("tag", filters.tag);
        if (filters.status !== "all") p.set("status", filters.status);
        if (filters.sort !== "popular") p.set("sort", filters.sort);
      }
      const qs = p.toString();
      return `#/explorar${qs ? "?" + qs : ""}`;
    }
    case "detail": return `#/obra/${workId ?? ""}`;
    case "assistant": return "#/assistente";
  }
}

function parseHash(): { view: View; workId: string | null; filters?: Partial<ExploreFilters> } {
  const h = typeof window === "undefined" ? "" : window.location.hash;
  if (h.startsWith("#/obra/")) {
    const id = h.slice("#/obra/".length).split(/[/?]/)[0];
    if (id) return { view: "detail", workId: id };
  }
  if (h.startsWith("#/explorar")) {
    const qs = h.split("?")[1] ?? "";
    const p = new URLSearchParams(qs);
    return {
      view: "explore",
      workId: null,
      filters: {
        q: p.get("q") ?? "",
        type: p.get("type") ?? "all",
        genre: p.get("genre") ?? "all",
        tag: p.get("tag") ?? "all",
        status: p.get("status") ?? "all",
        sort: p.get("sort") ?? "popular",
      },
    };
  }
  if (h.startsWith("#/assistente")) return { view: "assistant", workId: null };
  return { view: "home", workId: null };
}

export const usePortal = create<PortalState>((set, get) => ({
  view: "home",
  workId: null,
  filters: { ...DEFAULT_FILTERS },
  headerSearch: "",
  go: (view) => {
    if (typeof window !== "undefined") {
      window.location.hash = hashFor(view, null, get().filters);
    }
    const parsed = parseHash();
    set({ ...parsed, filters: { ...get().filters, ...(parsed.filters ?? {}) } });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  openWork: (id) => {
    if (typeof window !== "undefined") {
      window.location.hash = hashFor("detail", id);
    }
    set({ view: "detail", workId: id });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  openExplore: (partial) => {
    const filters = { ...get().filters, ...(partial ?? {}) };
    set({ filters, view: "explore", workId: null });
    if (typeof window !== "undefined") {
      window.location.hash = hashFor("explore", null, filters);
    }
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  setFilters: (partial) => {
    const filters = { ...get().filters, ...partial };
    set({ filters });
    if (typeof window !== "undefined" && get().view === "explore") {
      window.history.replaceState(null, "", hashFor("explore", null, filters));
    }
  },
  setHeaderSearch: (v) => set({ headerSearch: v }),
}));

/** Sincroniza navegação com o botão voltar/avançar do navegador */
export function bindHashSync() {
  const handler = () => {
    const parsed = parseHash();
    const st = usePortal.getState();
    if (parsed.view === "detail" && parsed.workId === st.workId && st.view === "detail") return;
    if (parsed.view === st.view && parsed.view !== "explore") return;
    usePortal.setState({
      view: parsed.view,
      workId: parsed.workId,
      filters: { ...st.filters, ...(parsed.filters ?? {}) },
    });
  };
  if (typeof window !== "undefined") {
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }
  return () => {};
}
