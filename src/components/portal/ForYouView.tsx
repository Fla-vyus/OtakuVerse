"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Wand2, Dices, Heart, BookMarked, Loader2, RefreshCw, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPE_LABEL, type WorkData, type WorkType } from "@/lib/types";
import { GENRE_PT } from "@/lib/tagmap";
import { usePortal } from "./store";
import { AoiMarkdown } from "./AoiMarkdown";
import { ForYouCard, CardSkeleton } from "./WorkCard";
import { usePersonal, SPICE_LABEL, type TasteProfile } from "./personal";

const ALL_TYPES: WorkType[] = ["manga", "manhwa", "manhua", "lightnovel", "anime"];
const VIBES: { key: TasteProfile["vibe"]; label: string; desc: string }[] = [
  { key: "leve", label: "Leve e gostosinho", desc: "slice of life, comédia, aconchego" },
  { key: "equilibrado", label: "Equilibrado", desc: "de tudo um pouco, conforme o dia" },
  { key: "pesado", label: "Pesado e intenso", desc: "psicológico, gore, drama feroz" },
];

interface ForYouItem {
  work: WorkData;
  score: number;
  reasons: string[];
}

/* ----------------------- Quiz de gosto ----------------------- */

function ChipSelect({ options, selected, onToggle }: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            onClick={() => onToggle(o)}
            className={`rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition ${
              on
                ? "border-primary bg-primary/10 text-primary"
                : "border-input bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
            }`}
          >
            {on && <Check className="mr-1 inline h-3 w-3" />}{o}
          </button>
        );
      })}
    </div>
  );
}

function TasteWizard({ genres, tags }: { genres: string[]; tags: string[] }) {
  const taste = usePersonal((s) => s.taste);
  const setTaste = usePersonal((s) => s.setTaste);
  const completeTaste = usePersonal((s) => s.completeTaste);
  const [step, setStep] = useState(0);

  const toggle = (key: "types" | "genres" | "tags") => (v: string) => {
    const cur = (taste[key] as string[]) ?? [];
    setTaste({ [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<TasteProfile>);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 sm:p-7"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-muted blur-3xl" />
      <div className="relative">
        <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
          <Wand2 className="h-3.5 w-3.5" /> perfil de gosto · passo {step + 1} de 4
        </div>
        <h2 className="font-display text-xl font-bold sm:text-2xl">Vamos calibrar o radar da Aoi 🔭</h2>
        <p className="mt-1 text-sm text-muted-foreground">Quanto mais honesto, melhores os achados. Leva 30 segundos.</p>

        <div className="mt-5 space-y-5">
          {step === 0 && (
            <>
              <p className="text-sm font-bold">Quais formatos você consome (ou quer começar)?</p>
              <div className="flex flex-wrap gap-2">
                {ALL_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => toggle("types")(t)}
                    className={`rounded-lg border px-4 py-2 text-sm font-bold transition ${
                      taste.types.includes(t)
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-input bg-white text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    {taste.types.includes(t) && <Check className="mr-1 inline h-3 w-3" />}{TYPE_LABEL[t]}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <p className="text-sm font-bold">Seus gêneros favoritos (quantos quiser):</p>
              <ChipSelect options={genres} selected={taste.genres} onToggle={toggle("genres")} />
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm font-bold">Qual nível de conteúdo sensorial você quer ver recomendado?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SPICE_LABEL.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setTaste({ spice: i as TasteProfile["spice"] })}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      taste.spice === i
                        ? "border-primary bg-primary/10"
                        : "border-input bg-white hover:border-primary/40"
                    }`}
                  >
                    <span className="block text-sm font-bold">{"🔥".repeat(i + 1)} {label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {["sem ecchi nas sugestões", "fanservice pontual é bem-vindo", "quero calor nas recomendações", "me manda o mais quente do catálogo"][i]}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <p className="text-sm font-bold">E o tom geral das histórias?</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {VIBES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => setTaste({ vibe: v.key })}
                    className={`rounded-lg border px-4 py-3 text-left transition ${
                      taste.vibe === v.key
                        ? "border-primary bg-primary/10"
                        : "border-input bg-white hover:border-primary/40"
                    }`}
                  >
                    <span className="block text-sm font-bold">{v.label}</span>
                    <span className="text-[11px] text-muted-foreground">{v.desc}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <button
            onClick={() => (step > 0 ? setStep(step - 1) : completeTaste())}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            {step > 0 ? "voltar" : "pular quiz"}
          </button>
          <Button
            onClick={() => (step < 3 ? setStep(step + 1) : completeTaste())}
            disabled={step === 0 && taste.types.length === 0}
            className="bg-brand-gradient font-bold text-primary-foreground shadow-md shadow-primary/30 hover:brightness-105"
          >
            {step < 3 ? "Continuar" : "Gerar minhas recomendações ✨"}
          </Button>
        </div>
      </div>
    </motion.section>
  );
}

/* ----------------------- View principal ----------------------- */

export function ForYouView() {
  const openExplore = usePortal((s) => s.openExplore);
  const taste = usePersonal((s) => s.taste);
  const setTaste = usePersonal((s) => s.setTaste);
  const completeTaste = usePersonal((s) => s.completeTaste);
  const favorites = usePersonal((s) => s.favorites);
  const lists = usePersonal((s) => s.lists);

  const [surprise, setSurprise] = useState(false);
  const [editing, setEditing] = useState(false);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ForYouItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [facets, setFacets] = useState<{ genres: string[]; tags: string[] }>({ genres: [], tags: [] });
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPicks, setAiPicks] = useState<string[] | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  // facetas para o quiz (agora tudo em ptTags)
  useEffect(() => {
    fetch("/api/works?perPage=1")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.facets) {
          const all: { name: string }[] = d.facets.tags ?? [];
          const genreSet = new Set(Object.keys(GENRE_PT));
          setFacets({
            genres: all.filter((g) => genreSet.has(g.name)).slice(0, 12).map((g) => g.name),
            tags: all.filter((t) => !genreSet.has(t.name)).slice(0, 18).map((t) => t.name),
          });
        }
      })
      .catch(() => {});
  }, []);

  const fetchPage = useCallback(
    (p: number, useSurprise: boolean) => {
      setLoading(true);
      fetch("/api/foryou", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taste, favorites, lists, surprise: useSurprise, page: p, adult: usePersonal.getState().settings.adult ? "show" : "hide" }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) {
            setItems(d.items);
            setTotal(d.total);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [taste, favorites, lists]
  );

  useEffect(() => {
    setAiText(null);
    setAiPicks(null);
    fetchPage(page, surprise);
  }, [fetchPage, page, surprise]);

  const askAoi = async () => {
    if (!items) return;
    setAiLoading(true);
    setAiError(null);
    setAiText(null);
    setAiPicks(null);
    try {
      const candidates = items.slice(0, 18).map((r) => ({
        id: r.work.id,
        title: r.work.title,
        type: r.work.type,
        score: r.score,
        genres: (r.work.ptTags ?? []).slice(0, 6),
        tags: r.work.tags.slice(0, 6).map((t) => t.name),
        note: r.work.avgScore ?? null,
        status: r.work.status ?? null,
      }));
      const reasons: Record<string, string[]> = {};
      items.slice(0, 18).forEach((r) => { reasons[r.work.id] = r.reasons; });
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates,
          reasons,
          taste,
          favorites: favorites.map((id) => ({ id, title: items.find((r) => r.work.id === id)?.work.title ?? "" })),
        }),
      });
      const d = await res.json();
      if (d.ok && d.text) {
        setAiText(d.text);
        const sug = d.text.split("[dica]")[0] ?? "";
        const ids = [...sug.matchAll(/\[#(\d+)\]/g)].map((m: any) => m[1]);
        setAiPicks(ids.length ? ids : null);
      } else {
        setAiError(d.error ?? "A Aoi ficou sem inspiração. Tente de novo.");
      }
    } catch {
      setAiError("Não consegui falar com a Aoi agora. Tente novamente.");
    } finally {
      setAiLoading(false);
    }
  };

  const showWizard = (!taste.done || editing);

  // ordena grid conforme picks da Aoi (quando existem)
  const grid = items
    ? aiPicks
      ? [...items].sort((a, b) => {
          const ia = aiPicks.indexOf(a.work.id);
          const ib = aiPicks.indexOf(b.work.id);
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        })
      : items
    : [];

  return (
    <div className="fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-0.5 flex items-center gap-2">
            <span className="overline-caps text-primary">Curadoria pessoal</span>
            <span className="h-px w-8 bg-border" aria-hidden />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Para <span className="text-gradient">Você</span></h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Afinidade calculada contra seu perfil {taste.done ? "" : "(padrão)"} · {favorites.length} favorito(s) · {total > 0 ? `${total.toLocaleString("pt-BR")} obras no radar` : "calculando..."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline" size="sm"
            onClick={() => { setSurprise((s0) => !s0); setPage(1); }}
            className="border-primary/30 bg-white text-primary hover:bg-primary/10 hover:text-primary"
          >
            <Dices className="h-4 w-4" /> {surprise ? "Saindo do caos" : "Surpreenda-me"}
          </Button>
          <Button
            onClick={askAoi} disabled={aiLoading || !taste.done || !items || items.length === 0}
            className="bg-brand-gradient font-bold text-primary-foreground shadow-md shadow-primary/30 hover:brightness-105"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {aiLoading ? "Aoi pensando..." : "Análise da Aoi"}
          </Button>
        </div>
      </div>

      {showWizard && (
        <div className="space-y-4">
          {taste.done && (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm">
              <span className="font-semibold text-primary">Editando seu perfil de gosto…</span>
              <button onClick={() => setEditing(false)} className="text-xs underline hover:text-foreground">cancelar edição</button>
            </div>
          )}
          <TasteWizard genres={facets.genres} tags={facets.tags} />
        </div>
      )}

      {!taste.done && !showWizard && (
        <section className="rounded-2xl border border-primary/30 bg-primary/10/70 p-6">
          <h3 className="font-display text-lg font-bold">Primeiro, me conte seu gosto 👀</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            O quiz de 4 passos calibra as recomendações. Ou favorite algumas obras nas páginas e a Aoi aprende com elas também.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setEditing(true)} className="bg-brand-gradient font-bold text-primary-foreground hover:brightness-105">
              <Wand2 className="h-4 w-4" /> Fazer o quiz
            </Button>
            <Button variant="outline" onClick={() => openExplore({})} className="border-input bg-white">
              <BookMarked className="h-4 w-4" /> Explorar catálogo antes
            </Button>
          </div>
        </section>
      )}

      {aiError && (
        <div className="rounded-xl border border-[#ecc7bf] bg-[#f9e4e0] px-4 py-3 text-sm text-[#9c3325]">{aiError}</div>
      )}

      {aiText && (
        <motion.section
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl border border-primary/30 bg-card p-5 sm:p-6"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
              <Sparkles className="h-3.5 w-3.5" /> curadoria personalizada da Aoi
            </p>
            <button onClick={askAoi} disabled={aiLoading} className="text-muted-foreground transition hover:text-foreground" aria-label="Gerar nova análise">
              <RefreshCw className={`h-4 w-4 ${aiLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          <div className="text-[13.5px] leading-relaxed text-foreground/90 sm:text-sm">
            <AoiMarkdown content={aiText.replace(/^\[sugestões\]\s*/i, "").replace(/\[dica\]\s*/i, "**💡 Dica da Aoi:** ")} />
          </div>
        </motion.section>
      )}

      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      )}

      {taste.done && !loading && grid.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
              {surprise ? "🎲 seleção caótica do radar" : aiPicks ? "✨ ordenado pela curadoria da Aoi" : "maior afinidade com seu perfil"}
            </span>
            {surprise && (
              <button onClick={() => setSurprise(false)} className="text-xs underline text-muted-foreground hover:text-foreground">
                voltar ao normal
              </button>
            )}
            {taste.done && !editing && (
              <button onClick={() => setEditing(true)} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground">
                <Pencil className="h-3 w-3" /> editar gosto
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {grid.map((r) => (
              <ForYouCard key={r.work.id} work={r.work} match={r.score} reasons={r.reasons} highlight={aiPicks?.includes(r.work.id)} />
            ))}
          </div>
          {total > 18 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="border-input bg-white">
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {Math.ceil(total / 18)}
              </span>
              <Button variant="outline" size="sm" disabled={page * 18 >= total} onClick={() => setPage((p) => p + 1)} className="border-input bg-white">
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      {taste.done && !loading && grid.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-10 text-center">
          <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-bold">Sem recomendações por aqui ainda</p>
          <p className="mt-1 text-sm text-muted-foreground">Favorite algumas obras que o radar liga mais rápido.</p>
        </div>
      )}
    </div>
  );
}
