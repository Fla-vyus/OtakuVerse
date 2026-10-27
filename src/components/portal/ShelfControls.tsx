"use client";

import { useEffect, useState } from "react";
import { Bookmark, Star, FolderPlus, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type WorkData } from "@/lib/types";

/** Metadados de exibição dos status da prateleira (ícone + rótulo PT-BR) */
const SHELF_META: { key: string; icon: string; label: string }[] = [
  { key: "READING", icon: "📖", label: "Lendo" },
  { key: "PLANNING", icon: "🔖", label: "Quero ler" },
  { key: "COMPLETED", icon: "✅", label: "Concluído" },
  { key: "FAVORITE", icon: "❤️", label: "Favorito" },
  { key: "PAUSED", icon: "⏸️", label: "Pausado" },
  { key: "DROPPED", icon: "🚪", label: "Abandonado" },
];
import { usePortal } from "./store";
import { useSaveWork, fetchShelf, fetchLists, addToList } from "./shelf";
import { useToast } from "@/hooks/use-toast";

interface Entry { status: string; rating: number | null; note: string | null; progress: number }
interface ListLite { id: string; name: string; emoji: string; inList: boolean }

export function ShelfControls({ work }: { work: WorkData }) {
  const user = usePortal((s) => s.user);
  const go = usePortal((s) => s.go);
  const { toast } = useToast();
  const save = useSaveWork();
  const [state, setState] = useState<{ key: string; entry: Entry | null; lists: ListLite[] } | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const key = `${user?.id ?? "anon"}:${work.id}`;
  const loaded = state?.key === key;
  const entry = loaded ? state?.entry ?? null : null;
  const lists = loaded ? state?.lists ?? [] : [];

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchShelf()
      .then((entries: any[]) => {
        if (!alive) return;
        const mine = entries.find((e) => e.workId === work.id);
        return { entry: mine ? { status: mine.status, rating: mine.rating, note: mine.note, progress: mine.progress } : null, listsPromise: fetchLists(), note: mine?.note ?? "" };
      })
      .then(async (packed: any) => {
        if (!alive || !packed) return;
        const ls = await packed.listsPromise;
        if (!alive) return;
        setState({
          key,
          entry: packed.entry,
          lists: (ls ?? []).map((l: any) => ({ id: l.id, name: l.name, emoji: l.emoji, inList: (l.works ?? []).some((w: WorkData) => w.id === work.id) })),
        });
        setNoteDraft(packed.note ?? "");
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [user, work.id, key]);

  if (!user) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-5 py-4">
        <p className="text-sm text-muted-foreground">
          <Bookmark className="mr-1.5 inline h-4 w-4 text-primary" />
          Entre na sua conta para salvar esta obra, dar nota e montar listas.
        </p>
        <Button size="sm" variant="outline" className="border-primary/40 text-primary" onClick={() => go("profile")}>
          <UserRound className="mr-1.5 h-3.5 w-3.5" /> Criar conta / Entrar
        </Button>
      </div>
    );
  }

  const currentStatus = entry?.status;

  const setStatus = async (status: string) => {
    await save(work.id, status, { silent: true });
    setState((s) => ({ key, entry: { status, rating: s?.entry?.rating ?? null, note: s?.entry?.note ?? null, progress: s?.entry?.progress ?? 0 }, lists: s?.lists ?? [] }));
  };

  const setRating = async (rating: number) => {
    const next = entry?.rating === rating ? null : rating;
    await fetch("/api/shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: work.id, rating: next, force: true }),
    });
    setState((s) => ({ key, entry: { status: s?.entry?.status ?? "PLANNING", rating: next, note: s?.entry?.note ?? null, progress: s?.entry?.progress ?? 0 }, lists: s?.lists ?? [] }));
    toast({ title: next ? `Nota ${next}/10 salva` : "Nota removida" });
  };

  const saveNote = async () => {
    await fetch("/api/shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workId: work.id, note: noteDraft, force: true }),
    });
    setState((s) => ({ key, entry: { status: s?.entry?.status ?? "PLANNING", rating: s?.entry?.rating ?? null, note: noteDraft, progress: s?.entry?.progress ?? 0 }, lists: s?.lists ?? [] }));
    setNoteOpen(false);
    toast({ title: "Anotação salva" });
  };

  const toggleList = async (listId: string, inList: boolean) => {
    await addToList(listId, work.id, inList ? "remove" : "add");
    setState((s) => ({ key, entry: s?.entry ?? null, lists: (s?.lists ?? []).map((l) => (l.id === listId ? { ...l, inList: !inList } : l)) }));
    toast({ title: inList ? "Removido da lista" : "Adicionado à lista" });
  };

  return (
    <div className="rounded-2xl border border-border bg-card/70 p-4 sm:p-5" data-loaded={String(loaded)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* status */}
        <Select value={currentStatus ?? undefined} onValueChange={setStatus}>
          <SelectTrigger className={`h-10 w-44 font-bold ${currentStatus ? "border-primary/50 text-primary" : ""}`} aria-label="Status na biblioteca">
            <SelectValue placeholder={<span className="flex items-center gap-2"><Bookmark className="h-4 w-4" /> Salvar na biblioteca</span>} />
          </SelectTrigger>
          <SelectContent>
            {SHELF_META.map((s) => (
              <SelectItem key={s.key} value={s.key}>{s.icon} {s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* nota 0-10 */}
        <div className="flex items-center gap-0.5" role="group" aria-label="Sua nota">
          {Array.from({ length: 10 }).map((_, i) => {
            const v = i + 1;
            return (
              <button
                key={v}
                onClick={() => setRating(v)}
                className="group p-0.5"
                title={`${v}/10`}
                aria-label={`Dar nota ${v}`}
              >
                <Star className={`h-4 w-4 transition ${(entry?.rating ?? 0) >= v ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 group-hover:text-amber-300"}`} />
              </button>
            );
          })}
          {entry?.rating != null && <span className="ml-1 text-xs font-bold text-amber-500">{entry.rating}/10</span>}
        </div>

        {/* anotação */}
        <Button size="sm" variant="outline" onClick={() => setNoteOpen(true)} className="h-10">
          {entry?.note ? "✏️ Anotação salva" : "📝 Anotar"}
        </Button>

        {/* listas */}
        {lists.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><FolderPlus className="h-3.5 w-3.5" /> Listas:</span>
            {lists.map((l) => (
              <button
                key={l.id}
                onClick={() => toggleList(l.id, l.inList)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${l.inList ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {l.emoji} {l.name} {l.inList ? "✓" : "+"}
              </button>
            ))}
          </div>
        )}
      </div>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anotação pessoal — {work.title}</DialogTitle>
          </DialogHeader>
          <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={5} placeholder="ex.: parei no cap 34, o arco do torneio é insano..." aria-label="Anotação" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancelar</Button>
            <Button onClick={saveNote} className="bg-brand-gradient text-white">Salvar anotação</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
