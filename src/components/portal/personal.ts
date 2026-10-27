"use client";

// Estado pessoal — POR CONTA (biblioteca, coleções, progresso, notas, histórico, gosto)
// Persistido em localStorage com chave por usuário (guest também tem o seu espaço).
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { WorkType } from "@/lib/types";
import { useAuth } from "./accounts";

export type ListStatus = "quero" | "lendo" | "lido" | "pausei" | "dropei";

export const LIST_STATUS_LABEL: Record<ListStatus, string> = {
  quero: "Quero ler/ver",
  lendo: "Lendo/Assistindo",
  lido: "Concluído",
  pausei: "Em pausa",
  dropei: "Dropado",
};

export const LIST_STATUS_COLOR: Record<ListStatus, string> = {
  quero: "bg-[#E8F0F7] text-[#33586E] border-[#C6D9E7]",
  lendo: "bg-[#FBF0D4] text-[#8A5A0B] border-[#EDDCA8]",
  lido: "bg-[#E9F0DF] text-[#55621C] border-[#D5DFB8]",
  pausei: "bg-[#F1EBE0] text-[#6E6252] border-[#DDD2BE]",
  dropei: "bg-[#F9E4E0] text-[#9C3325] border-[#ECC7BF]",
};

export const LIST_STATUS_ICON: Record<ListStatus, string> = {
  quero: "🔖",
  lendo: "📖",
  lido: "✅",
  pausei: "⏸️",
  dropei: "🚪",
};

export interface ListEntry {
  status: ListStatus;
  rating?: number; // nota pessoal 1–10
  progress?: number; // caps/eps consumidos
  note?: string; // anotação pessoal
  addedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  ids: string[];
  createdAt: number;
}

export interface TasteProfile {
  done: boolean;
  types: WorkType[];
  genres: string[]; // nomes PT-BR (ptTags)
  tags: string[]; // tags PT-BR
  spice: 0 | 1 | 2 | 3; // 0 leve → 3 máximo ecchi
  vibe: "leve" | "equilibrado" | "pesado"; // tom preferido
}

export const DEFAULT_TASTE: TasteProfile = {
  done: false,
  types: [],
  genres: [],
  tags: [],
  spice: 1,
  vibe: "equilibrado",
};

export const COLLECTION_EMOJIS = ["📚", "💖", "🔥", "⭐", "🌙", "🏆", "🍰", "👻", "⚔️", "🌀", "🎬", "📖", "🧋", "🌸", "🃏", "🐉"];

interface PersonalState {
  favorites: string[];
  lists: Record<string, ListEntry>;
  collections: Record<string, Collection>;
  history: string[]; // últimos 60 ids vistos
  taste: TasteProfile;
  settings: {
    adult: boolean; // mostra +18/Hentai no catálogo
  };
  // favoritos
  toggleFavorite: (id: string) => boolean;
  isFavorite: (id: string) => boolean;
  // listas
  setList: (id: string, status: ListStatus | null) => void;
  rate: (id: string, rating: number) => void;
  setProgress: (id: string, n: number) => void;
  bumpProgress: (id: string) => void;
  setNote: (id: string, note: string) => void;
  // coleções
  createCollection: (name: string, emoji: string, desc?: string) => string;
  deleteCollection: (id: string) => void;
  updateCollection: (id: string, partial: Partial<Pick<Collection, "name" | "emoji" | "desc">>) => void;
  toggleCollectionItem: (colId: string, workId: string) => boolean;
  // histórico
  pushHistory: (id: string) => void;
  removeFromHistory: (id: string) => void;
  // gosto
  setTaste: (partial: Partial<TasteProfile>) => void;
  completeTaste: () => void;
  // configurações
  setAdult: (v: boolean) => void;
  clearAll: () => void;
}

// ---------- persistência por usuário ----------
let activeKey = "otakuverse-personal-guest";

function dynamicStorage() {
  return {
    getItem: () => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(activeKey);
    },
    setItem: (_name: string, value: string) => {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(activeKey, value);
    },
    removeItem: () => {
      if (typeof window === "undefined") return;
      window.localStorage.removeItem(activeKey);
    },
  };
}

/** Troca o espaço pessoal ativo (chamado no login/logout/registro) */
export function switchPersonalUser(uid: string | null) {
  activeKey = uid ? `otakuverse-personal-${uid}` : "otakuverse-personal-guest";
  usePersonal.persist.rehydrate();
}

export const usePersonal = create<PersonalState>()(
  persist(
    (set, get) => ({
      favorites: [],
      lists: {},
      collections: {},
      history: [],
      taste: { ...DEFAULT_TASTE },
      settings: { adult: true },

      toggleFavorite: (id) => {
        const has = get().favorites.includes(id);
        set({ favorites: has ? get().favorites.filter((f) => f !== id) : [id, ...get().favorites] });
        return !has;
      },
      isFavorite: (id) => get().favorites.includes(id),

      setList: (id, status) => {
        const lists = { ...get().lists };
        if (!status) delete lists[id];
        else lists[id] = { status, rating: lists[id]?.rating, progress: lists[id]?.progress, note: lists[id]?.note, addedAt: Date.now() };
        set({ lists });
      },

      rate: (id, rating) => {
        const lists = { ...get().lists };
        if (!lists[id]) lists[id] = { status: "lido", addedAt: Date.now() };
        lists[id] = { ...lists[id], rating };
        set({ lists });
      },

      setProgress: (id, n) => {
        const lists = { ...get().lists };
        const cur = lists[id] ?? { status: "lendo" as ListStatus, addedAt: Date.now() };
        lists[id] = { ...cur, progress: Math.max(0, n), status: cur.status === "quero" ? "lendo" : cur.status };
        set({ lists });
      },

      bumpProgress: (id) => {
        const lists = { ...get().lists };
        const cur = lists[id] ?? { status: "lendo" as ListStatus, addedAt: Date.now(), progress: 0 };
        lists[id] = { ...cur, progress: (cur.progress ?? 0) + 1, status: cur.status === "quero" ? "lendo" : cur.status };
        set({ lists });
      },

      setNote: (id, note) => {
        const lists = { ...get().lists };
        if (!lists[id] && !note) return;
        if (!lists[id]) lists[id] = { status: "lendo", addedAt: Date.now() };
        lists[id] = { ...lists[id], note };
        set({ lists });
      },

      createCollection: (name, emoji, desc = "") => {
        const id = `c${Date.now().toString(36)}${Math.floor(Math.random() * 1e3).toString(36)}`;
        const collections = { ...get().collections };
        collections[id] = { id, name: name.trim() || "Nova coleção", emoji, desc, ids: [], createdAt: Date.now() };
        set({ collections });
        return id;
      },

      deleteCollection: (id) => {
        const collections = { ...get().collections };
        delete collections[id];
        set({ collections });
      },

      updateCollection: (id, partial) => {
        const collections = { ...get().collections };
        if (!collections[id]) return;
        collections[id] = { ...collections[id], ...partial };
        set({ collections });
      },

      toggleCollectionItem: (colId, workId) => {
        const collections = { ...get().collections };
        const col = collections[colId];
        if (!col) return false;
        const has = col.ids.includes(workId);
        collections[colId] = { ...col, ids: has ? col.ids.filter((x) => x !== workId) : [workId, ...col.ids] };
        set({ collections });
        return !has;
      },

      pushHistory: (id) => {
        const h = get().history.filter((x) => x !== id);
        set({ history: [id, ...h].slice(0, 60) });
      },

      removeFromHistory: (id) => set({ history: get().history.filter((x) => x !== id) }),

      setTaste: (partial) => set({ taste: { ...get().taste, ...partial } }),
      completeTaste: () => set({ taste: { ...get().taste, done: true } }),

      setAdult: (v) => set({ settings: { ...get().settings, adult: v } }),

      clearAll: () => set({ favorites: [], lists: {}, collections: {}, history: [], taste: { ...DEFAULT_TASTE } }),
    }),
    {
      name: activeKey,
      storage: createJSONStorage(dynamicStorage),
      version: 2,
      migrate: (persisted: any, version) => {
        // v1 → v2: campos novos ganham defaults
        if (version < 2) {
          return {
            ...persisted,
            collections: persisted?.collections ?? {},
            settings: persisted?.settings ?? { adult: true },
          };
        }
        return persisted as PersonalState;
      },
    }
  )
);

// ---------- Sincronização com a sessão ----------
if (typeof window !== "undefined") {
  // boot: pega a sessão salva
  const sessionUid = useAuth.getState().sessionUid;
  switchPersonalUser(sessionUid);
  // acompanha login/logout
  useAuth.subscribe((state, prev) => {
    if (state.sessionUid !== prev.sessionUid) switchPersonalUser(state.sessionUid);
  });
}

export const SPICE_LABEL = ["Só o básico", "Leve tecido", "Bem picante", "Modo ecchi total"];
