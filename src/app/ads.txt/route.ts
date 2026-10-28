// ads.txt — IAB Tech Lab: autoriza quem pode VENDER anúncio em nome do domínio.
// O Google AdSense exige este arquivo na RAIZ do domínio final.
// Sem NEXT_PUBLIC_ADSENSE_CLIENT configurada, devolve 404 limpo (não serve placeholder
// quebrado). Ao aprovar a conta AdSense, basta colocar a env e o arquivo sai sozinho.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
  if (!client) {
    return new NextResponse("ads.txt não configurado — defina NEXT_PUBLIC_ADSENSE_CLIENT", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  const line = `google.com, ${client}, DIRECT, f08c47fec0942fa0`;
  return new NextResponse(line + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
