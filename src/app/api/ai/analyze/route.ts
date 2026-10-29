import { NextRequest, NextResponse } from "next/server";
import { createAoi } from "@/lib/ai";
import { getWorkById, getAllWorks, computeRelated } from "@/lib/works";
import { db } from "@/lib/db";
import { TYPE_LABEL, STATUS_LABEL, fmtDate, fmtNum, type WorkData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function workBrief(w: WorkData): string {
  const tags = w.tags.slice(0, 10).map((t) => `${t.name}(${t.rank})`).join(", ");
  return [
    `${w.title} [#${w.id}] — ${TYPE_LABEL[w.type]} | ${STATUS_LABEL[w.status ?? ""] ?? w.status}`,
    `Nota: ${w.avgScore ?? "?"}/100 · Popularidade: ${fmtNum(w.popularity)} · Favoritos: ${fmtNum(w.favourites)}`,
    `Gêneros: ${w.genres.join(", ")}`,
    `Tags: ${tags}`,
    w.chapters ? `Capítulos: ${w.chapters}` : w.episodes ? `Episódios: ${w.episodes}` : "",
    `Início: ${fmtDate(w.startDate)}${w.endDate ? ` · Fim: ${fmtDate(w.endDate)}` : ""}`,
    `Autores: ${w.authors.map((a) => `${a.name} (${a.role})`).join(", ") || "—"}`,
    `Sinopse: ${(w.synopsis ?? "sem sinopse").replace(/\n/g, " ").slice(0, 400)}`,
  ].filter(Boolean).join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    const work = await getWorkById(String(id));
    if (!work) return NextResponse.json({ ok: false, error: "Obra não encontrada" }, { status: 404 });

    const all = await getAllWorks();
    const related = computeRelated(work, all);
    const similarList = related.similar.slice(0, 8)
      .map((w) => `- ${w.title} [#${w.id}] (nota ${w.avgScore ?? "?"}) — ${w.genres.join(", ")}`)
      .join("\n");

    const spicy = work.tags.some((t) => ["Nudity", "Sexual Content", "Succubus", "Psychosexual"].includes(t.name));

    const prompt = `Analise a obra abaixo como a Aoi, curadora veterana do portal OtakuVerse (Brasil). Escreva em português do Brasil, com personalidade: opiniões francas, sem bordoata genérica. Use levemente humor e referências de fã.

OBRA:
${workBrief(work)}

OBRAS PARECIDAS (do catálogo):
${similarList}

Produza EXATAMENTE este markdown (sem bloco de código, sem título grande no topo):

**Veredito:** 2-3 frases diretas: vale a pena? qual a proposta?

🎨 **Arte & Visual** — 2-4 frases sobre o estilo visual/trajetória da arte.

📖 **História & Ritmo** — 3-5 frases: premissa, evolução, ritmo, maior qualidade e maior fraqueza.

🔥 **Conteúdo sensorial** — 1-3 frases sobre o nível de conteúdo picante/fanservice (se não houver, diga que é "fresco/leve"). ${spicy ? "A obra tem conteúdo sensorial relevante — detalhe o nível com bom humor." : "A obra é mais contida nesse aspecto."}

👤 **Para quem é** — 2-3 frases com perfil de leitor, citando 2-3 obras parecidas do catálogo com marcador [#ID].

⚠️ **Pontos de atenção** — 1-3 frases: content warnings, ritmo, hiato, final aberto, etc.

🎯 **Nota curadora:** X/10 — 1 frase justificando.`;

    const zai = await createAoi();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "Você é a Aoi, curadora do OtakuVerse. Responda em PT-BR. Siga exatamente a estrutura pedida, em markdown, sem blocos de código. Seja específica sobre A OBRA dada, nunca genérica." },
        { role: "user", content: prompt },
      ],
      thinking: { type: "disabled" },
    });
    const analysis = completion.choices[0]?.message?.content ?? "";
    if (!analysis.trim()) throw new Error("Resposta vazia da IA");

    // Gera e cacheia sinopse em PT-BR
    let synopsisPT = work.synopsisPT ?? null;
    if (!synopsisPT && work.synopsis) {
      try {
        const t = await zai.chat.completions.create({
          messages: [
            { role: "assistant", content: "Traduza e adapte a sinopse a seguir para português do Brasil natural e atraente, em 2-4 frases. Responda APENAS com a sinopse traduzida, sem comentários." },
            { role: "user", content: work.synopsis },
          ],
          thinking: { type: "disabled" },
        });
        const translated = (t.choices[0]?.message?.content ?? "").trim();
        if (translated) {
          synopsisPT = translated;
          await db.work.update({ where: { id: work.id }, data: { synopsisPT: translated } });
        }
      } catch {
        // tradução é bônus — falha silenciosa
      }
    }

    return NextResponse.json({ ok: true, analysis, synopsisPT });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
