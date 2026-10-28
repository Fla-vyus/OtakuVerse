// Sitemap do OtakuVerse (SEO).
// O portal é uma SPA de hash (#/explorar etc.) — crawlers indexam a raiz e as
// rotas com hash não são URLs separadas. O sitemap declara a raiz oficial e a
// data de atualização do catálogo (lastmod), sinalizando frescura ao buscador.
// O domínio público vem de NEXT_PUBLIC_SITE_URL (definido no deploy do gateway);
// sem ele, cai no localhost — o robots.txt e a meta canonical continuam corretos.
import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
