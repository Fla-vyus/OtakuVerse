// Cache HTTP para rotas públicas e iguais para todo mundo (home, notícias, agenda…).
// O navegador pula a re-busca em navegações repetidas (max-age) e serve stale
// enquanto revalida (stale-while-revalidate) — sensação de site instantâneo.
// NUNCA aplicar em respostas de erro ({ok:false}) nem em rotas de sessão.
export const PUBLIC_CACHE = (maxAge = 120) =>
  `public, max-age=${maxAge}, stale-while-revalidate=600`;

export function cachedJson(data: any, maxAge = 120, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": PUBLIC_CACHE(maxAge),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}
