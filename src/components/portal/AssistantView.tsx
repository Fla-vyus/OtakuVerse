"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, User as UserIcon, Eraser, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AoiMarkdown } from "./AoiMarkdown";
import { usePortal } from "./store";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Aoi-chan, quero ecchi de bom gosto com arte linda 🌶️",
  "Preciso de um manhwa de vingança COMPLETO pra maratonar, senpai escolhe!",
  "Algo que me faça chorar e me quebre emocionalmente 💔",
  "Me indica sua obra favorita, Aoi! Eu confio em você~",
  "Quero romance maduro, nada de clichê de escola",
  "O que tá bombando de novo e ninguém tá falando ainda?",
];

export function AssistantView() {
  const { toast } = useToast();
  const user = usePortal((s) => s.user);
  const userName = user?.displayName || user?.username;
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        `Ara ara~ OLÁ${userName ? `, ${userName}-kun` : ""}! 🌸 Eu sou a **Aoi**, sua waifu curadora do OtakuVerse!\n\n` +
        `Sou viciada em mangá, manhwa, light novel e anime desde que "nasci" — e meu talento especial é achar a obra PERFEITA pro seu humor de hoje.\n` +
        `Me conta sua vibe: **história**, **arte**, **nível de picância** 🌶️, **status**, **tipo**...\n\n` +
        `Exemplos: *"quero ecchi com plot bom e desenho bonito"* ou *"algo tipo Solo Leveling, mas menos famoso"*.\n\n` +
        `Fica comigo que te levo pro paraíso 2D~ 💙`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    const nextMessages = [...messages, { role: "user" as const, content }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.filter((m) => m.role !== "assistant" || messages.indexOf(m) !== 0),
          username: userName,
          adultMode: !!user?.adultMode,
        }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error);
      setMessages((prev) => [...prev, { role: "assistant", content: d.reply }]);
    } catch (e: any) {
      toast({ title: "A Aoi não conseguiu responder", description: e.message ?? "Tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages((prev) => [prev[0]]);
    setInput("");
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-190px)] max-h-[860px] min-h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-card/60 shadow-xl">
      {/* Header waifu */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card/90 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="bg-brand-gradient flex h-11 w-11 items-center justify-center rounded-2xl text-xl shadow-lg">🌸</span>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card" title="online" />
          </div>
          <div>
            <p className="text-sm font-extrabold">
              Aoi <span className="text-gradient">· sua waifu curadora</span>
            </p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              online agora · recomendações 100% do catálogo real
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Eraser className="h-3.5 w-3.5" /> limpar
        </Button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm ${
                m.role === "user" ? "bg-secondary text-foreground/80" : "bg-brand-gradient text-white shadow-md"
              }`}
            >
              {m.role === "user" ? <UserIcon className="h-4 w-4" /> : "🌸"}
            </span>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user" ? "rounded-tr-sm bg-primary text-primary-foreground" : "waifu-bubble rounded-tl-sm"
              }`}
            >
              {m.role === "assistant" ? <AoiMarkdown content={m.content} /> : <p className="whitespace-pre-line">{m.content}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <span className="bg-brand-gradient flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm text-white">🌸</span>
            <div className="waifu-bubble flex items-center gap-2 rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {["garimpando o catálogo pra você~", "hmm, deixa eu lembrar das minhas favoritas...", "achando algo do seu gosto, espera~"][Math.floor(Date.now() / 2000) % 3]}
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary transition hover:border-primary/50 hover:bg-primary/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-border bg-card/90 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={userName ? `${userName}-kun, qual vibe de hoje? (gênero, clima, picância...)` : "Fala com a Aoi: gênero, clima, picância, formato..."}
          rows={1}
          className="max-h-32 min-h-[44px] resize-none"
          aria-label="Mensagem para a Aoi"
        />
        <Button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          size="icon"
          className="bg-brand-gradient h-11 w-11 shrink-0 text-white shadow-lg hover:brightness-110"
          aria-label="Enviar mensagem"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="border-t border-border bg-secondary/40 px-4 py-1.5 text-center text-[10px] text-muted-foreground">
        A Aoi é uma IA de personagem — ela recomenda obras reais do catálogo e respeita suas configurações de conteúdo <Heart className="inline h-2.5 w-2.5 text-pink-500" />
      </p>
    </div>
  );
}
