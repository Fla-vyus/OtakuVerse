// Índice de sitemaps do OtakuVerse — /sitemap.xml (referenciado pelo robots.txt).
//
// v3.8: o sitemap monolítico (~40k URLs, 6.3MB) excede o limite de tamanho de
// RESPOSTA de função na Vercel (4.5MB) — agora o catálogo é dividido em chunks
// (/sitemap/0.xml … /sitemap/3.xml) e este índice aponta para todos. Também é a
// recomendação do Google para catálogos grandes (cada sitemap ≤ 50k URLs / 50MB).
// A zona adulta NUNCA entra (indexabilidade = só catálogo safe/suggestive).
import { NextResponse } from "next/server";

export const revalidate = 21600; // 6h — ISR: CDN cacheia, banco quase não é tocado

const CHUNKS = 4;

export async function GET(req: Request) {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const now = new Date().toISOString();

  const entries = Array.from({ length: CHUNKS }, (_, i) => `  <sitemap>
    <loc>${base}/sitemap/${i}.xml</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
