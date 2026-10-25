"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Loader2, User as UserIcon, Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AoiMarkdown } from "./AoiMarkdown";

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Quero algo picante com ecchi de bom gosto e arte linda 🌶️",
  "Manhwa de ação COMPLETO pra maratonar no fim de semana",
  "Algo psicológico com plot twist que me quebre",
  "Light novel que originou um anime bom",
  "Romance fora do padrão, nada de clichê de escola",
  "O que tem de novo e pouco conhecido que está bombando?",
];

function renderContent(content: string) {
  return <AoiMarkdown content={content} />;
}

export function AssistantView() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Oiê! Eu sou a **Aoi**, curadora-chefe do OtakuVerse 🌙\n\nMe diz qual vibe você tá procurando — posso filtrar por **história**, **arte**, **nível de picância**, **status** (completo/andamento), **tipo** (mangá, manhwa, LN, anime)... quanto mais específico, melhor a dose.\n\nEx.: *\"quero um manhwa completo de ação com protagonismo feminino\"* ou *\"algo tipo Chainsaw Man, mas menos visto\"*.",
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
        body: JSON.stringify({ messages: nextMessages.filter((m) => m.role !== "assistant" || messages.indexOf(m) !== 0) }),
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
    <div className="fade-in mx-auto flex h-[calc(100dvh-170px)] max-h-[860px] min-h-[520px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/8 bg-card/50">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-white/8 bg-card/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="bg-brand-gradient flex h-10 w-10 items-center justify-center rounded-xl text-lg shadow-lg shadow-violet-950/40">🍡</span>
          <div>
            <p className="text-sm font-extrabold">Aoi <span className="text-gradient">· curadora IA</span></p>
            <p className="text-[11px] text-muted-foreground">recomendações reais do catálogo + descobertas</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <Eraser className="h-3.5 w-3.5" /> limpar
        </Button>
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm ${
              m.role === "user" ? "bg-secondary text-foreground/80" : "bg-brand-gradient text-white shadow-md shadow-violet-950/40"
            }`}>
              {m.role === "user" ? <UserIcon className="h-4 w-4" /> : "🍡"}
            </span>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user"
                ? "rounded-tr-sm bg-primary/90 text-white"
                : "rounded-tl-sm border border-white/8 bg-secondary/60"
            }`}>
              {m.role === "assistant" ? renderContent(m.content) : <p className="whitespace-pre-line">{m.content}</p>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <span className="bg-brand-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm text-white">🍡</span>
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-white/8 bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> a Aoi está garimpando obras...
            </div>
          </div>
        )}
      </div>

      {/* Sugestões */}
      {messages.length <= 1 && !loading && (
        <div className="flex flex-wrap gap-2 border-t border-white/8 px-4 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-[12px] text-violet-200 transition hover:border-primary/50 hover:bg-primary/20"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-white/8 bg-card/80 p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Descreva sua vibe: gênero, clima, picância, formato..."
          rows={1}
          className="max-h-32 min-h-[44px] resize-none border-white/10 bg-secondary/50"
          aria-label="Mensagem para a Aoi"
        />
        <Button
          onClick={() => send()}
          disabled={loading || !input.trim()}
          size="icon"
          className="bg-brand-gradient h-11 w-11 shrink-0 text-white shadow-lg shadow-violet-950/40 hover:brightness-110"
          aria-label="Enviar mensagem"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
