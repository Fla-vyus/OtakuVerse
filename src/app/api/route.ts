import { NextResponse } from "next/server";

export async function GET() {
  // rota raiz da API: diagnóstico mínimo — sempre 200
  return NextResponse.json({ ok: true, app: "OtakuVerse", at: new Date().toISOString() });
}
