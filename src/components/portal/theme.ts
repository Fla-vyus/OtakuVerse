"use client";

// Temas & personalização — persistidos em localStorage, aplicados no <html>
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ThemeDef {
  id: string;
  label: string;
  emoji: string;
  dark: boolean;
  swatch: string; // cor do chip de preview
  hint: string;
}

export const THEMES: ThemeDef[] = [
  { id: "azul", label: "Azul & Branco", emoji: "💠", dark: false, swatch: "#1d63d8", hint: "o clássico limpo (padrão)" },
  { id: "meianoite", label: "Meia-Noite", emoji: "🌙", dark: true, swatch: "#529bff", hint: "azul profundo pra madrugada" },
  { id: "sakura", label: "Sakura", emoji: "🌸", dark: false, swatch: "#d6336c", hint: "rosa pétala delicado" },
  { id: "oceano", label: "Oceano", emoji: "🌊", dark: false, swatch: "#0b7d8c", hint: "verde-azulado fresquinho" },
  { id: "floresta", label: "Floresta", emoji: "🌲", dark: false, swatch: "#2b7a3d", hint: "verde aconchegante" },
  { id: "lavanda", label: "Lavanda", emoji: "💜", dark: false, swatch: "#6d3fc4", hint: "roxo calmo" },
  { id: "papel", label: "Papel & Tinta", emoji: "📜", dark: false, swatch: "#bc4b22", hint: "o clássico terracota da v3" },
  { id: "cafe", label: "Café", emoji: "☕", dark: false, swatch: "#8a5a2b", hint: "marrom quente aconchegante" },
  { id: "grafite", label: "Grafite", emoji: "🖤", dark: true, swatch: "#8fa8e8", hint: "escuro neutro e elegante" },
];

export const ACCENTS: { hex: string; label: string }[] = [
  { hex: "#1d63d8", label: "Azul" },
  { hex: "#0ea5e9", label: "Céu" },
  { hex: "#0b7d8c", label: "Petróleo" },
  { hex: "#2b7a3d", label: "Verde" },
  { hex: "#d6336c", label: "Pink" },
  { hex: "#9333ea", label: "Roxo" },
  { hex: "#e8590c", label: "Laranja" },
  { hex: "#dc2626", label: "Vermelho" },
  { hex: "#0f172a", label: "Tinta" },
];

interface ThemeState {
  theme: string;
  accent: string | null; // sobrescreve a cor primária do tema
  fontSize: "sm" | "md" | "lg";
  blurAdult: boolean;
  setTheme: (id: string) => void;
  setAccent: (hex: string | null) => void;
  setFontSize: (fs: "sm" | "md" | "lg") => void;
  setBlurAdult: (v: boolean) => void;
}

function isLight(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.72;
}

export function applyTheme(theme: string, accent: string | null, fontSize: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const def = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  root.dataset.theme = def.id;
  root.dataset.fs = fontSize;

  if (accent) {
    const gradB = shade(accent, def.dark ? 18 : -12);
    root.style.setProperty("--primary", accent);
    root.style.setProperty("--ring", accent);
    root.style.setProperty("--grad-a", accent);
    root.style.setProperty("--grad-b", gradB);
    root.style.setProperty("--primary-foreground", isLight(accent) ? "#14161c" : "#ffffff");
    root.style.setProperty("--sidebar-primary", accent);
    root.style.setProperty("--chart-1", accent);
  } else {
    root.style.removeProperty("--primary");
    root.style.removeProperty("--ring");
    root.style.removeProperty("--grad-a");
    root.style.removeProperty("--grad-b");
    root.style.removeProperty("--primary-foreground");
    root.style.removeProperty("--sidebar-primary");
    root.style.removeProperty("--chart-1");
  }
}

function shade(hex: string, pct: number): string {
  const h = hex.replace("#", "");
  const num = parseInt(h.slice(0, 6), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 255) + (pct / 100) * 255);
  const g = clamp(((num >> 8) & 255) + (pct / 100) * 255);
  const b = clamp((num & 255) + (pct / 100) * 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const useTheme = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "azul",
      accent: null,
      fontSize: "md",
      blurAdult: true,
      setTheme: (id) => {
        set({ theme: id });
        applyTheme(id, get().accent, get().fontSize);
      },
      setAccent: (hex) => {
        set({ accent: hex });
        applyTheme(get().theme, hex, get().fontSize);
      },
      setFontSize: (fs) => {
        set({ fontSize: fs });
        applyTheme(get().theme, get().accent, fs);
      },
      setBlurAdult: (v) => set({ blurAdult: v }),
    }),
    {
      name: "otakuverse-theme-v1",
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme, state.accent, state.fontSize);
      },
    }
  )
);
