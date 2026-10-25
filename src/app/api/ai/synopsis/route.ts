import { NextRequest, NextResponse } from "next/server";
import ZAI from "z-ai-web-dev-sdk";
import { getWorkById } from "@/lib/works";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    const work = await getWorkById(String(id));
    if (!work) return NextResponse.json({ ok: false, error: "Obra não encontrada" }, { status: 404 });
    if (work.synopsisPT) return NextResponse.json({ ok: true, synopsisPT: work.synopsisPT, cached: true });
    if (!work.synopsis) return NextResponse.json({ ok: true, synopsisPT: null, cached: false });

    const zai = await ZAI.create();
    const t = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: "Traduza e adapte a sinopse a seguir para português do Brasil natural e atraente, em 2-4 frases. Responda APENAS com a sinopse traduzida, sem comentários nem aspas." },
        { role: "user", content: work.synopsis },
      ],
      thinking: { type: "disabled" },
    });
    const translated = (t.choices[0]?.message?.content ?? "").trim();
    if (!translated) throw new Error("Tradução vazia");
    await db.work.update({ where: { id: work.id }, data: { synopsisPT: translated } });
    return NextResponse.json({ ok: true, synopsisPT: translated, cached: false });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
