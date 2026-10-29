// Chunk do sitemap — /sitemap/0.xml até /sitemap/3.xml (gerados pelo índice
// /sitemap.xml). v3.8: substitui o monolítico de 6.3MB, que estouraria o limite
// de resposta de função da Vercel (4.5MB). Cada chunk fica em ~1.6-2MB — folga
// confortável e dentro da régua do Google (50k URLs / 50MB por arquivo).
// A zona adulta NUNCA entra (indexabilidade = só catálogo safe/suggestive).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const revalidate = 21600; // 6h — ISR: CDN cacheia, banco quase não é tocado

const CHUNKS = 4;
const MAX_URLS = 48_000; // folga antes do teto de 50k do Google

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;"
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // aceita "/sitemap/0" e "/sitemap/0.xml" (o sufixo vem junto no param)
  const { id } = await params;
  const idx = Number(id.replace(/\.xml$/i, ""));
  if (!Number.isInteger(idx) || idx < 0 || idx >= CHUNKS) {
    return new NextResponse("Not found", { status: 404 });
  }

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin).replace(/\/$/, "");
  const per = Math.ceil(MAX_URLS / CHUNKS);

  const urls: { loc: string; lastmod?: string; freq: string; priority: string }[] = [];
  if (idx === 0) {
    urls.push({ loc: `${base}/`, freq: "hourly", priority: "1.0" });
  }

  try {
    const rows = await db.work.findMany({
      where: { isAdult: false, type: { not: "drama" } },
      select: { id: true, lastUpdate: true },
      orderBy: { id: "asc" },
      skip: idx * per,
      take: per,
    });
    for (const r of rows) {
      urls.push({
        loc: `${base}/obra/${escapeXml(r.id)}`,
        lastmod: r.lastUpdate ? new Date(r.lastUpdate * 1000).toISOString() : undefined,
        freq: "daily",
        priority: "0.7",
      });
    }
  } catch {
    // falha no DB: chunk sai só com a raiz (idx 0) ou vazio — nunca quebra a página
  }

  const body = urls
    .map((u) => `  <url>
    <loc>${u.loc}</loc>
${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ""}    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
