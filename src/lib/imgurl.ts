// Helper de URLs de capa — v4.0 (ETAPA 4): DIRETO primeiro, proxy só como fallback.
// Camadas no cliente (WorkCard/CoverThumb):
//   1. URL DIRETA da capa (CDN AniList/Kitsu/MAL) em tamanho MEDIUM nas listas
//   2. URL direta alternativa (coverAlt) ou large — se a medium falhar
//   3. /api/img (proxy mesma-origem) — SÓ para domínio que bloquear hotlink
//      (limite de 3 downloads simultâneos no servidor, timeout 5s, sem cache)
//   4. card visual de texto — NUNCA imagem fake
//
// Por quê: com capas diretas o tráfego de imagens sai do servidor publicado
// (RAM apertada) e vai para os CDNs das fontes + cache do navegador.

/** Versão "medium" da capa para listas — AniList entrega /large/ nas URLs;
 *  /medium/ é ~4x mais leve e visualmente idêntica num card de 150-180px. */
export function mediumCover(url?: string | null): string | null {
  if (!url) return null;
  if (url.includes("anilist.co") && url.includes("/cover/large/")) {
    return url.replace("/cover/large/", "/cover/medium/");
  }
  return url;
}

/** URL direta principal (medium quando pedimos lista). */
export function directCover(work: { cover?: string | null; coverAlt?: string | null }, size: "medium" | "large" = "medium"): string | null {
  const primary = size === "medium" ? mediumCover(work.cover) : work.cover ?? null;
  return primary ?? work.coverAlt ?? null;
}

/** Fallback PROXY mesma-origem (só quando a direta falhar no navegador). */
export function proxyImg(primary?: string | null, fallback?: string | null): string | null {
  if (!primary && !fallback) return null;
  const u = primary ?? fallback!;
  const p = new URLSearchParams({ u });
  if (fallback && fallback !== u) p.set("f", fallback);
  return `/api/img?${p.toString()}`;
}

/** Fontes alternativas para a mesma capa quando conhecemos o malId (MAL CDN) */
export function malCover(malId?: number | null, kind: "manga" | "anime" = "manga"): string | null {
  if (!malId) return null;
  return `https://cdn.myanimelist.net/images/${kind}/${malId}.jpg`;
}
