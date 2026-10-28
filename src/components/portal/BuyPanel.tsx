"use client";

// Painel de compra por afiliados — cada língua/país tem as SUAS lojas.
// Aparece nas páginas de detalhe de obras não-adultas. O usuário pode trocar o
// país (detecção automática pelo navegador é só o padrão). Conformidade:
// rel="sponsored noopener" + disclosure de comissão visível (política Amazon
// Associates e Google). Sem loja/tag configurada, continua útil: link direto.

import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, ExternalLink, BookOpen, Globe2 } from "lucide-react";
import {
  detectRegion, getRegionOverride, setRegionOverride, storesFor,
  workKindOf, REGION_KEYS, REGIONS, type AffRegion,
} from "@/lib/affiliates";
import type { WorkData } from "@/lib/types";

const KIND_LABEL: Record<string, string> = {
  livraria: "livro/impressos",
  ebook: "ebooks",
  sebo: "sebos — usados e raros",
  marketplace: "marketplace",
  geek: "geek/imports",
};

export default function BuyPanel({ work }: { work: WorkData }) {
  const [region, setRegion] = useState<AffRegion | null>(null);
  const [open, setOpen] = useState(false);

  // obras adultas NUNCA têm painel de compra (nem na zona +18) — linha vermelha
  const blocked = work.classification === "adult" || work.type === "drama";

  useEffect(() => {
    setRegion(getRegionOverride() ?? detectRegion());
  }, []);

  const links = useMemo(() => {
    if (!region || blocked) return [];
    return storesFor(region, work.titleEn || work.title, workKindOf(work));
  }, [region, work, blocked]);

  if (blocked) return null;

  const primary = links[0];
  const rest = links.slice(1);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={open}
      >
        <p className="flex items-center gap-2 text-sm font-black">
          <ShoppingBag className="h-4 w-4 text-primary" /> Onde comprar
        </p>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {region ? REGIONS[region].label : "…"}
        </span>
      </button>

      {/* seletor de país — afiliados são POR PAÍS: cada mercado tem lojas e programas próprios */}
      <div className="mt-2.5 flex items-center gap-2">
        <Globe2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <select
          value={region ?? "BR"}
          onChange={(e) => {
            const r = e.target.value as AffRegion;
            setRegion(r);
            setRegionOverride(r);
          }}
          className="w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs font-bold outline-none focus:ring-1 focus:ring-primary"
          aria-label="País da loja"
        >
          {REGION_KEYS.map((k) => (
            <option key={k} value={k}>{REGIONS[k].label}</option>
          ))}
        </select>
      </div>

      {primary && (
        <a
          href={primary.url}
          target="_blank"
          rel="sponsored noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground transition hover:opacity-90"
        >
          <ShoppingBag className="h-4 w-4" />
          Comprar em {primary.name}
          <ExternalLink className="h-3.5 w-3.5 opacity-70" />
        </a>
      )}

      {rest.length > 0 && (
        <div className="mt-2 grid gap-1.5">
          {rest.map((s) => (
            <a
              key={s.id}
              href={s.url}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="flex items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-xs font-bold transition hover:bg-accent"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{KIND_LABEL[s.kind] ?? s.kind}</span>
            </a>
          ))}
        </div>
      )}

      <p className="mt-2.5 text-[10px] leading-relaxed text-muted-foreground">
        Links de afiliados: o OtakuVerse pode receber uma comissão por compras qualificadas —
        sem custo extra para você. É assim que o portal se mantém no ar.
      </p>
    </div>
  );
}
