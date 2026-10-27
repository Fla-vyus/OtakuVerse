"use client";

// Cliente da biblioteca (prateleira) — helpers de fetch + estado global
import { usePortal } from "./store";
import { useToast } from "@/hooks/use-toast";

export async function fetchMe() {
  try {
    const r = await fetch("/api/auth/me");
    const d = await r.json();
    return d.ok ? { user: d.user, counts: d.counts ?? {} } : { user: null, counts: {} };
  } catch {
    return { user: null, counts: {} };
  }
}

export async function fetchShelf() {
  const r = await fetch("/api/shelf");
  if (!r.ok) return [];
  const d = await r.json();
  return d.ok ? d.entries : [];
}

export async function fetchLists() {
  const r = await fetch("/api/lists");
  if (!r.ok) return [];
  const d = await r.json();
  return d.ok ? d.lists : [];
}

export function useSaveWork() {
  const user = usePortal((s) => s.user);
  const { toast } = useToast();
  return async (workId: string, status: string, opts?: { silent?: boolean }) => {
    if (!user) {
      toast({ title: "Entre na sua conta", description: "Crie uma conta ou faça login para salvar obras na biblioteca." });
      return false;
    }
    try {
      const r = await fetch("/api/shelf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workId, status }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      if (!opts?.silent) {
        toast({ title: d.removed ? "Removido da biblioteca" : "Salvo na biblioteca", description: d.removed ? undefined : `Status: ${labelFor(status)}` });
      }
      return true;
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message });
      return false;
    }
  };
}

function labelFor(status: string) {
  const map: Record<string, string> = {
    READING: "Lendo", PLANNING: "Quero ler", COMPLETED: "Concluído", FAVORITE: "Favorito", PAUSED: "Pausado", DROPPED: "Abandonado",
  };
  return map[status] ?? status;
}

export async function addToList(listId: string, workId: string, op: "add" | "remove") {
  const r = await fetch(`/api/lists/${listId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workId, op }),
  });
  return r.json();
}
