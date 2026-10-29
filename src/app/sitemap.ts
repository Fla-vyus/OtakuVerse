// Sitemap do OtakuVerse (SEO) — TODAS as obras do catálogo público em um único sitemap.
// 39.918 URLs ≈ 2,5MB — dentro do limite do Google (50.000 URLs / 50MB por sitemap).
// A zona adulta NUNCA entra (indexabilidade = só catálogo safe/suggestive).
// O domínio público vem de NEXT_PUBLIC_SITE_URL (configurável no deploy).
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_URLS = 48_000; // folga antes do teto de 50k do Google

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

  const entries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];

  try {
    const rows = await db.work.findMany({
      where: { isAdult: false, type: { not: "drama" } },
      select: { id: true, lastUpdate: true },
      orderBy: { id: "asc" },
      take: MAX_URLS,
    });
    for (const r of rows) {
      entries.push({
        url: `${base}/obra/${r.id}`,
        lastModified: r.lastUpdate ? new Date(r.lastUpdate * 1000) : new Date(),
        changeFrequency: "daily",
        priority: 0.7,
      });
    }
  } catch {
    // falha no DB: sitemap sai só com a raiz — nunca quebra a página
  }

  return entries;
}
