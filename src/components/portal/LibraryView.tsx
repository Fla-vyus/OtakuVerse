"use client";

import { useEffect, useMemo, useState } from "react";
import { Library, Loader2, Search, Trash2, Star, CloudCheck, CloudOff } from "lucide-react";
import { usePortal, LIB_STATUS_LABEL, type LibraryEntry } from "./store";
import { WorkCard } from "./WorkCard";
import type { WorkData } from "@/lib/types";

const STATUS_ORDER: LibraryEntry["status"][] = ["reading", "plan", "favorite", "completed", "paused", "dropped"];

export function LibraryView() {
  const user = usePortal((s) => s.user);
  const authChecked = usePortal((s) => s.authChecked);
  const library = usePortal((s) => s.library);
  const upsertLocal = usePortal((s) => s.upsertLocal);
  const removeLocal = usePortal((s) => s.removeLocal);
  const syncState = usePortal((s) => s.syncState);
  const go = usePortal((s) => s.go);
  const [works, setWorks] = useState<Record<string, WorkData>>({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const ids = useMemo(() => Object.keys(library), [library]);

  // reset derivado em render (padrão oficial React) — biblioteca esvaziada limpa a grade
  const [prevIds, setPrevIds] = useState(ids);
  if (prevIds !== ids) {
    setPrevIds(ids);
    if (!ids.length) {
      setWorks({});
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    if (!ids.length) return;
    let alive = true;
    Promise.all(
      chunks(ids, 100).map((chunk) =>
        fetch(`/api/works/bulk?ids=${encodeURIComponent(chunk.join(","))}`)
          .then((r) => r.json())
          .catch(() => null)
      )
    ).then((batches) => {
      if (!alive) return;
      const map: Record<string, WorkData> = {};
      for (const b of batches) {
        if (b?.ok) for (const w of b.items) map[w.id] = w;
      }
      setWorks(map);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [ids.join(",")]);

  if (!authChecked) return <div className="py-20 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>;

  if (!user) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
        <Library className="h-10 w-10 text-muted-foreground" />
        <p className="text-lg font-black">Sua biblioteca espera por você</p>
        <p className="text-sm text-muted-foreground">
          Entre com sua conta para salvar favoritos, listas de leitura e notas — com sincronização na nuvem.
          Sem conta, você pode favoritar e tudo fica salvo localmente no navegador.
        </p>
        <div className="flex gap-2">
          <button onClick={() => go("auth")} className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white">Entrar / Criar conta</button>
          <button onClick={() => go("explore")} className="rounded-xl border border-border px-5 py-2.5 text-sm font-bold">Explorar catálogo</button>
        </div>
      </div>
    );
  }

  const filtered = ids.filter((id) => {
    if (!q.trim()) return true;
    const w = works[id];
    return w ? w.title.toLowerCase().includes(q.toLowerCase()) : true;
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Library className="h-6 w-6 text-primary" /> Minha Biblioteca
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {syncState === "syncing" ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> sincronizando com a nuvem...</>
            ) : syncState === "error" ? (
              <><CloudOff className="h-3 w-3 text-destructive" /> offline — usando espelho local</>
            ) : (
              <><CloudCheck className="h-3 w-3 text-emerald-500" /> sincronizado na sua nuvem</>
            )}
            · {ids.length} itens
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar na biblioteca..." className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-sm" />
        </div>
      </div>

      {loading && ids.length > 0 ? (
        <div className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></div>
      ) : ids.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Library className="h-8 w-8 text-muted-foreground" />
          <p className="font-bold">Biblioteca vazia</p>
          <p className="max-w-sm text-xs text-muted-foreground">Abra qualquer obra e use "Quero ver/ler", "Estou lendo" ou "Favorito" para começar sua coleção.</p>
          <button onClick={() => go("explore")} className="bg-brand-gradient mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white">Explorar catálogo</button>
        </div>
      ) : (
        STATUS_ORDER.filter((st) => filtered.some((id) => library[id]?.status === st)).map((st) => {
          const list = filtered.filter((id) => library[id]?.status === st);
          if (!list.length) return null;
          return (
            <section key={st}>
              <p className="mb-2.5 text-sm font-black">
                {LIB_STATUS_LABEL[st]} <span className="ml-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">{list.length}</span>
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {list.map((id) => {
                  const w = works[id];
                  const entry = library[id];
                  if (!w) {
                    return (
                      <div key={id} className="flex aspect-[2/3] items-center justify-center rounded-2xl border border-border bg-card p-2 text-center text-[10px] text-muted-foreground">
                        {id}
                      </div>
                    );
                  }
                  return (
                    <div key={id} className="relative">
                      <WorkCard work={w} />
                      <div className="mt-1.5 flex items-center gap-1">
                        <select
                          value={entry.status}
                          onChange={(e) => upsertLocal({ ...entry, status: e.target.value as LibraryEntry["status"], updatedAt: new Date().toISOString() })}
                          className="h-7 w-full rounded-lg border border-input bg-card px-1 text-[10px] font-bold"
                          aria-label="Status"
                        >
                          {STATUS_ORDER.map((s) => <option key={s} value={s}>{LIB_STATUS_LABEL[s]}</option>)}
                        </select>
                        <select
                          value={entry.rating ?? ""}
                          onChange={(e) => upsertLocal({ ...entry, rating: e.target.value ? Number(e.target.value) : null, updatedAt: new Date().toISOString() })}
                          className="h-7 w-16 shrink-0 rounded-lg border border-input bg-card px-1 text-[10px] font-bold"
                          aria-label="Nota"
                        >
                          <option value="">⭐</option>
                          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button
                          onClick={() => removeLocal(id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground transition hover:border-destructive/40 hover:text-destructive"
                          aria-label="Remover"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

function chunks<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
