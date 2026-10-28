import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
  } catch {
    // isolamento: falha ao limpar sessão não pode quebrar o logout do cliente
  }
  return NextResponse.json({ ok: true });
}
