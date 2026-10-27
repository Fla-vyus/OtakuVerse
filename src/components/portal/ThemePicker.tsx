"use client";

// Seletor de temas & personalização: 9 temas, cor de acento, tamanho da fonte, blur +18
import { useState, useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette, Check } from "lucide-react";
import { THEMES, ACCENTS, useTheme, applyTheme } from "./theme";

const noopSubscribe = () => () => {};

export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { theme, accent, fontSize, blurAdult, setTheme, setAccent, setFontSize, setBlurAdult } = useTheme();
  const [open, setOpen] = useState(false);
  // false no SSR, true no cliente — evita mismatch de hidratação sem setState em effect
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const current = THEMES.find((t) => t.id === (mounted ? theme : "azul"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label="Temas e personalização"
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-foreground/75 transition hover:border-primary/40 hover:text-primary ${
            compact ? "h-10 w-10" : "h-10 px-3"
          }`}
        >
          <Palette className="h-4 w-4" />
          {!compact && <span className="text-[12px] font-semibold">{current?.emoji ?? "💠"} Tema</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[330px] rounded-2xl border-border p-4" sideOffset={8}>
        <p className="overline-caps mb-2 text-primary">Personalizar</p>
        <p className="font-display mb-3 text-sm font-bold">Temas</p>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              title={t.hint}
              className={`group flex flex-col items-center gap-1 rounded-xl border p-2 text-center transition ${
                theme === t.id ? "border-primary bg-primary/10" : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[13px] shadow-sm"
                style={{ background: `linear-gradient(135deg, ${t.swatch} 0%, ${t.swatch}cc 100%)` }}
              >
                {t.emoji}
              </span>
              <span className="text-[9.5px] font-bold leading-tight">{t.label}</span>
            </button>
          ))}
        </div>

        <p className="font-display mb-2 text-sm font-bold">Cor de destaque</p>
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setAccent(null)}
            className={`flex h-7 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold transition ${
              accent === null ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            <Check className="h-3 w-3" /> do tema
          </button>
          {ACCENTS.map((a) => (
            <button
              key={a.hex}
              onClick={() => setAccent(a.hex)}
              title={a.label}
              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${
                accent === a.hex ? "border-foreground" : "border-transparent"
              }`}
              style={{ background: a.hex }}
              aria-label={`Acento ${a.label}`}
            />
          ))}
        </div>

        <p className="font-display mb-2 mt-4 text-sm font-bold">Tamanho da fonte</p>
        <div className="mb-4 grid grid-cols-3 gap-1.5">
          {([["sm", "P"], ["md", "M"], ["lg", "G"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFontSize(v)}
              className={`rounded-lg border py-1.5 text-xs font-bold transition ${
                fontSize === v ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border bg-muted/50 px-3 py-2.5">
          <span className="text-xs font-semibold">
            Desfocar capas +18
            <span className="block text-[10px] font-normal text-muted-foreground">revela ao passar o mouse</span>
          </span>
          <input
            type="checkbox"
            checked={blurAdult}
            onChange={(e) => setBlurAdult(e.target.checked)}
            className="h-4 w-4 accent-[var(--primary)]"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}
