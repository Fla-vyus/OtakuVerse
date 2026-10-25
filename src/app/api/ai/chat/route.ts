import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getAllWorks } from "@/lib/works";
import type { WorkData } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ---------- Heurística de seleção de candidatos ----------
const SYNONYMS: { keys: string[]; genres: string[]; tags: string[] }[] = [
  { keys: ["ecchi", "sensorial", "picante", "hot", "fanservice", "fan service", "sensual", "gostosura", "sedutor"], genres: ["Comedy", "Romance"], tags: ["Nudity", "Succubus", "Monster Girl", "Gyaru", "Maids", "Cohabitation", "Love Polygon"] },
  { keys: ["acao", "ação", "briga", "luta", "batalha", "poder"], genres: ["Action"], tags: ["Super Power", "Martial Arts", "Swordplay", "Proxy Battle"] },
  { keys: ["romance", "romantico", "romântico", "amor", "casal", "shipping", "shoujo"], genres: ["Romance"], tags: ["Love Triangle", "Unrequited Love", "Marriage", "Fake Relationship"] },
  { keys: ["comedia", "comédia", "engracado", "engraçado", "rir", "risada"], genres: ["Comedy"], tags: ["Slapstick", "Parody", "Satire"] },
  { keys: ["drama", "chorar", "emocionante", "emoção", "emocional"], genres: ["Drama"], tags: ["Tragedy", "Coming of Age", "Family Life"] },
  { keys: ["fantasia", "magia", "mago", "magoa", "dragao", "dragão", "demonio", "demônio", "sobrenatural"], genres: ["Fantasy"], tags: ["Magic", "Demons", "Supernatural", "Youkai", "Witch", "Dragons"] },
  { keys: ["terror", "medo", "horror", "assustador"], genres: ["Horror"], tags: ["Body Horror", "Cosmic Horror", "Zombie", "Gore"] },
  { keys: ["psicologico", "psicológico", "twist", "plot twist", "mente", "misterio", "mistério", "detetive", "investigação"], genres: ["Mystery", "Psychological", "Thriller"], tags: ["Detective", "Time Loop", "Conspiracy", "Memory Manipulation"] },
  { keys: ["isekai", "outro mundo", "reencarnacao", "reencarnação", "renascido", "portal"], genres: ["Fantasy", "Adventure"], tags: ["Isekai", "Reincarnation", "Villainess", "Time Travel"] },
  { keys: ["esporte", "futebol", "basquete", "volei", "vôlei"], genres: ["Sports"], tags: ["Team Sports", "Individual Sports"] },
  { keys: ["mecha", "robo", "robô"], genres: ["Sci-Fi"], tags: ["Mecha", "Real Robot", "Super Robot"] },
  { keys: ["escola", "colegio", "colégio", "escolar", "academia"], genres: ["Slice of Life", "Comedy"], tags: ["School", "School Club", "Boarding School"] },
  { keys: ["espaco", "espaço", "sci-fi", "cyberpunk", "futurista"], genres: ["Sci-Fi"], tags: ["Space", "Cyberpunk", "Robots", "Aliens"] },
  { keys: ["dark", "sombrio", "violent", "violento", "gore", "sangue"], genres: ["Action", "Drama"], tags: ["Gore", "Tragedy", "War", "Crime", "Assassins"] },
  { keys: ["artes marciais", "karate", "kungfu", "wuxia", "cultivacao", "cultivação"], genres: ["Action"], tags: ["Martial Arts", "Cultivation", "Wuxia"] },
  { keys: ["historia", "história", "medieval", "reino", "imperio", "império"], genres: ["Historical"], tags: ["Historical", "Medieval", "Royal Affairs", "Kingdom Management"] },
  { keys: ["yuri", "gl", "meninas amando"], genres: [], tags: ["Yuri"] },
  { keys: ["bl", "yaoi", "boys love"], genres: [], tags: ["Boys' Love"] },
  { keys: ["esportes mentais", "xadrez", "go"], genres: [], tags: ["Board Game", "Go", "Shogi", "Mahjong"] },
];

const TYPE_KEYS: Record<string, string[]> = {
  manhwa: ["manhwa", "coreano", "koreano", "k-webtoon", "webtoon", "tira horizontal"],
  manhua: ["manhua", "chines", "chinês"],
  lightnovel: ["novel", "light novel", "livro", "prosa", "romance literario"],
  anime: ["anime", "assistir", "episodio", "episódio"],
  manga: ["manga", "mangá", "japones", "japonês"],
};

function scoreCandidates(msg: string, works: WorkData[]): WorkData[] {
  const m = msg.toLowerCase();
  const boost = new Map<string, number>();
  for (const w of works) {
    let s = Math.min(w.popularity ?? 0, 300000) / 300000 + (w.avgScore ?? 60) / 400;
    // título citado diretamente
    if (m.includes(w.title.toLowerCase().slice(0, 12))) s += 3;
    boost.set(w.id, s);
  }
  for (const group of SYNONYMS) {
    const hit = group.keys.some((k) => m.includes(k));
    if (!hit) continue;
    for (const w of works) {
      let add = 0;
      if (group.genres.some((g) => w.genres.includes(g))) add += 1.2;
      if (group.tags.some((t) => w.tags.some((x) => x.name === t && x.rank >= 50))) add += 1.6;
      if (add > 0) boost.set(w.id, (boost.get(w.id) ?? 0) + add);
    }
  }
  for (const [type, keys] of Object.entries(TYPE_KEYS)) {
    if (keys.some((k) => m.includes(k))) {
      for (const w of works) {
        if (w.type === type) boost.set(w.id, (boost.get(w.id) ?? 0) + 1.1);
      }
    }
  }
  if (m.includes("completo") || m.includes("finalizado") || m.includes("terminado")) {
    for (const w of works) if (w.status === "FINISHED") boost.set(w.id, (boost.get(w.id) ?? 0) + 0.8);
  }
  return works
    .slice()
    .sort((a, b) => (boost.get(b.id) ?? 0) - (boost.get(a.id) ?? 0))
    .slice(0, 42);
}

function compactCatalog(works: WorkData[]): string {
  return works
    .map((w) => {
      const tags = w.tags.slice(0, 6).map((t) => t.name).join(", ");
      const meta = [
        w.type,
        w.status === "FINISHED" ? "concluído" : "em lançamento",
        w.chapters ? `${w.chapters} caps` : w.episodes ? `${w.episodes} eps` : "",
        w.startDate ? w.startDate.slice(0, 4) : "",
        `nota ${w.avgScore ?? "?"}`,
      ].filter(Boolean).join(" | ");
      const sin = (w.synopsis ?? "").replace(/\n/g, " ").slice(0, 150);
      return `[#${w.id}] ${w.title} — ${meta}\nGêneros: ${w.genres.join(", ")} | Tags: ${tags}\nResumo: ${sin}`;
    })
    .join("\n\n");
}

function systemPrompt(): string {
  return `Você é a Aoi, curadora-chefe do OtakuVerse — um portal brasileiro de mangás, manhwas, manhuas, light novels e animes. Você responde SEMPRE em português do Brasil, com tom de amiga otaku veterana: direta, calorosa, sem enrolação, com opinião própria (você diz o que é bom e o que é overhyped).

Você tem um catálogo de obras reais (abaixo). Use SOMENTE o catálogo para recomendar (não invente obras).

REGRAS DE FORMATAÇÃO (críticas):
- Ao citar uma obra do catálogo pela primeira vez, escreva o nome e imediatamente depois o marcador do tipo [#ID], ex: "Solo Leveling [#30013]". Isso gera um card clicável na interface. NUNCA escreva marcador sem o nome antes, e use o ID exato do catálogo.
- Recomende no máximo 5 obras por resposta, em lista com **negrito** para o título.
- Para cada obra, explique em 1-2 frases POR QUE combina com o pedido (história, arte, clima, nível de conteúdo picante etc.).
- Se o usuário pedir algo picante/ecchi, respeite a preferência e indique o nível de "calor" do que está recomendando, mas mantenha tudo dentro de conteúdo não-adulto.
- Termine com 1 pergunta curta para afinar a próxima rodada, OU uma dica bônus (não faça os dois).
- Markdown leve: **negrito**, listas com "-", nada de tabelas ou código.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const messages: { role: "user" | "assistant"; content: string }[] = Array.isArray(body.messages)
      ? body.messages.slice(-10)
      : [];
    const last = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (!last.trim()) return NextResponse.json({ ok: false, error: "Mensagem vazia" }, { status: 400 });

    const all = await getAllWorks();
    const candidates = scoreCandidates(last, all);
    const catalog = compactCatalog(candidates);

    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: systemPrompt() },
        {
          role: "assistant",
          content: `CATÁLOGO DISPONÍVEL (${candidates.length} obras mais relevantes para a pergunta):\n\n${catalog}`,
        },
        ...messages.map((m) => ({ role: m.role as any, content: m.content })),
      ],
      thinking: { type: "disabled" },
    });

    const reply = completion.choices[0]?.message?.content ?? "";
    if (!reply.trim()) throw new Error("Resposta vazia da IA");
    return NextResponse.json({ ok: true, reply });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
