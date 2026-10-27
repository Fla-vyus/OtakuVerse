// Helper de URLs de imagem com fallback multi-fonte (cliente)
// Camadas de proteção contra imagens que somem:
//  1. /api/img proxy mesma-origem (servidor busca sem referer + cache em disco)
//  2. se proxy falhar → tenta URL direta com referrerpolicy="no-referrer" (outra fonte)
//  3. se tudo falhar → card visual com texto (NUNCA imagem fake)
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
