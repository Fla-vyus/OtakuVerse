import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getWorkById } from "@/lib/works";
import { TYPE_LABEL, type WorkData } from "@/lib/types";
import type { TasteProfile } from "@/components/portal/personal";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface CandidateBrief {
  id: string;
  title: string;
  type: string;
  score: number;
  genres: string[];
  tags: string[];
  note: number | null;
  status: string | null;
}

function brief(c: CandidateBrief): string {
  return `- ${c.title} [#${c.id}] · ${TYPE_LABEL[c.type as keyof typeof TYPE_LABEL] ?? c.type} · nota ${c.note ?? "?"} · ${c.status ?? ""} · gêneros: ${c.genres.join("/") || "—"} · tags: ${c.tags.slice(0, 5).join(", ") || "—"} · afinidade calculada: ${c.score.toFixed(1)}`;
}

function tasteLine(t: TasteProfile): string {
  const spice = ["só o básico", "leve", "bem picante", "ecchi total"][t.spice] ?? "médio";
  return [
    `Formatos preferidos: ${t.types.map((x) => TYPE_LABEL[x]).join(", ") || "todos"}`,
    `Gêneros favoritos: ${t.genres.join(", ") || "não especificou"}`,
    `Tags favoritas: ${t.tags.join(", ") || "não especificou"}`,
    `Nível de picância desejado: ${spice}`,
    `Tom preferido: ${t.vibe}`,
  ].join(" · ");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const candidates: CandidateBrief[] = Array.isArray(body.candidates) ? body.candidates.slice(0, 30) : [];
    const taste: TasteProfile = body.taste;
    const favorites: { id: string; title: string }[] = Array.isArray(body.favorites) ? body.favorites.slice(0, 15) : [];
    const reasonMap: Record<string, string[]> = body.reasons ?? {};

    if (!taste || candidates.length === 0) {
      return NextResponse.json({ ok: false, error: "Dados insuficientes" }, { status: 400 });
    }

    // Enriquece com dados reais do banco (sinopse curta)
    const synopses = await Promise.all(
      candidates.slice(0, 18).map(async (c) => {
        const w: WorkData | null = await getWorkById(c.id).catch(() => null);
        return w ? `- ${w.title}: ${(w.synopsis ?? "").replace(/\n/g, " ").slice(0, 180)}` : "";
      })
    );

    const prompt = `Você é a Aoi, curadora IA veterana do portal OtakuVerse (Brasil), especialista em mangás, manhwas, manhuas, light novels e animes. Um motor algorítmico já pré-selecionou candidatos para o usuário. Sua missão: escrever a RECOMENDAÇÃO PESSOAL final em português do Brasil.

PERFIL DO USUÁRIO:
${tasteLine(taste)}

${favorites.length ? `OBRAS QUE ELE FAVORITOU (referência de gosto): ${favorites.map((f) => f.title).join("; ")}` : "Usuário ainda não favoritou obras."}

CANDIDATOS PRÉ-SELECIONADOS (afinidade calculada por overlap de tags/gêneros):
${candidates.map(brief).join("\n")}

SINOPSES RESUMIDAS:
${synopses.filter(Boolean).join("\n")}

${Object.keys(reasonMap).length ? `MOTIVOS ALGORÍTMICOS (overlap detectado): ${Object.entries(reasonMap).slice(0, 12).map(([id, r]) => `[#${id}] ${r.join("; ")}`).join(" | ")}` : ""}

REGRAS:
1. Escolha as 8 MELHORES obras para ESTE usuário (não precisa seguir a ordem de afinidade — use seu juízo de curadora: qualidade, coerência com o perfil, variedade).
2. NUNCA recomende algo que conflite com o nível de picância pedido.
3. Escreva EXATAMENTE neste formato markdown (sem bloco de código):

[sugestões]
[#{id}] — 1-2 frases explicando POR QUE essa obra combina com ESSE usuário específico (cite o gosto dele, seja específica e franca).

[dica]
2-4 frases finais: um conselho pessoal de leitura/ordem sugerida, com a personalidade da Aoi (opiniões francas, humor leve de fã, sem genericidade).

Os marcadores [#{id}] devem usar EXATAMENTE o id numérico dado. Não invente obras fora da lista.`;

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: "Você é a Aoi, curadora IA do OtakuVerse. Responda sempre em português do Brasil, com opiniões francas e conhecimento real de cultura otaku. Siga EXATAMENTE o formato pedido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 1400,
    });

    const text = completion?.choices?.[0]?.message?.content ?? "";
    if (!text) return NextResponse.json({ ok: false, error: "Resposta vazia da IA" }, { status: 502 });

    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    console.error("ai/recommend error:", e?.message);
    return NextResponse.json({ ok: false, error: "Falha na análise" }, { status: 500 });
  }
}
