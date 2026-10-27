"use client";

import { useEffect, useState } from "react";
import { ShieldAlert, Loader2, Lock, ShieldOff, Search } from "lucide-react";
import { usePortal, DEFAULT_FILTERS } from "./store";
import { CardGrid } from "./WorkCard";
import type { WorkData } from "@/lib/types";

/** Zona Adulta — só existe na navegação quando o Modo +18 está ativo no perfil.
 *  Conteúdo 100% separado do catálogo principal (nunca entra na home/buscas). */
export function AdultZoneView() {
  const user = usePortal((s) => s.user);
  const authChecked = usePortal((s) => s.authChecked);
  const go = usePortal((s) => s.go);
  const [items, setItems] = useState<WorkData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("popular");
  const [tag, setTag] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user?.adultMode) return;
    setItems(null);
    const p = new URLSearchParams({ zone: "adult", sort, page: String(page), perPage: "60" });
    if (tag !== "all") p.set("tag", tag);
    if (q.trim()) p.set("q", q.trim());
    fetch(`/api/works?${p}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setItems(d.items);
          setTotal(d.total);
        } else setError(d.error);
      })
      .catch(() => setError("Erro de conexão"));
  }, [user?.adultMode, sort, tag, q, page]);

  if (!authChecked) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <Lock className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-black">Área restrita</p>
        <p className="text-sm text-muted-foreground">Entre na sua conta. O conteúdo adulto fica escondido por padrão e só aparece com o Modo +18 ativado no perfil.</p>
        <button onClick={() => go("auth")} className="bg-brand-gradient rounded-xl px-6 py-2.5 text-sm font-bold text-white">Entrar</button>
      </div>
    );
  }

  if (!user.adultMode) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <ShieldOff className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-black">Modo Adulto está desligado</p>
        <p className="text-sm text-muted-foreground">
          A Zona Adulta (doujins, hentai, +18) fica oculta e separada do catálogo. Se quiser, ative a opção escondida dentro de
          <strong> Perfil → Configurações de conteúdo</strong> — com confirmação de idade.
        </p>
        <button onClick={() => go("profile")} className="bg-brand-gradient rounded-xl px-6 py-2.5 text-sm font-bold text-white">Abrir meu perfil</button>
        <button onClick={() => go("home")} className="text-xs font-bold text-muted-foreground hover:underline">prefiro ficar no catálogo normal</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
        <h1 className="flex items-center gap-2 text-2xl font-black">
          <ShieldAlert className="h-6 w-6 text-red-600 dark:text-red-400" /> Zona Adulta
        </h1>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Conteúdo classificado +18 (hentai, doujin, adulto). Esta área é <strong>separada</strong> do catálogo principal — nada aqui
          aparece na home, no hype ou nas buscas normais. Você pode desligar o modo quando quiser no perfil. Se você é menor de idade,
          desligue agora; isto não é para você.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar na zona adulta..."
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm"
          />
        </div>
        <select
          value={tag}
          onChange={(e) => { setTag(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-semibold"
          aria-label="Tag adulta"
        >
          <option value="all">Todas as categorias</option>
          <option value="Doujin">Doujin</option>
          <option value="Hentai">Hentai</option>
          <option value="+18">+18</option>
        </select>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setPage(1); }}
          className="h-10 rounded-xl border border-input bg-card px-3 text-sm font-semibold"
          aria-label="Ordenar"
        >
          <option value="popular">Mais populares</option>
          <option value="score">Melhores notas</option>
          <option value="favorites">Mais favoritados</option>
          <option value="new">Mais recentes</option>
        </select>
      </div>

      <p className="text-xs text-muted-foreground">{items ? `${total.toLocaleString("pt-BR")} obras · página ${page}` : "carregando..."}</p>

      {error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-sm font-bold text-destructive">{error}</div>
      ) : !items ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">Nada encontrado com esses filtros.</div>
      ) : (
        <CardGrid items={items} />
      )}

      {items && total > 60 && (
        <div className="flex items-center justify-center gap-3 pb-4">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold disabled:opacity-40">
            ← Anterior
          </button>
          <span className="text-sm font-bold text-muted-foreground">{page} / {Math.ceil(total / 60)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * 60 >= total} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold disabled:opacity-40">
            Próxima →
          </button>
        </div>
      )}
    </div>
  );
}
