// Cache HTTP para rotas públicas e iguais para todo mundo (home, notícias, agenda…).
// O navegador pula a re-busca em navegações repetidas (max-age) e serve stale
// enquanto revalida (stale-while-revalidate) — sensação de site instantâneo.
// NUNCA aplicar em respostas de erro ({ok:false}) nem em rotas de sessão.
//
// GZIP CENTRAL (v3.6): o Next comprime páginas HTML mas NÃO comprime respostas de
// Route Handlers — /api/sections (306KB) e /api/schedule (200KB) viajavam cru.
// JSON comprime ~80-85% com gzip: 306KB → ~45KB. Compressão por resposta aqui,
// no único ponto por onde TODA resposta pública de API passa.
import { headers } from "next/headers";
import { gzipSync } from "node:zlib";

export const PUBLIC_CACHE = (maxAge = 120) =>
  `public, max-age=${maxAge}, stale-while-revalidate=600`;

export async function cachedJson(data: any, maxAge = 120, init?: ResponseInit) {
  const json = JSON.stringify(data);
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": PUBLIC_CACHE(maxAge),
    Vary: "Accept-Encoding",
    ...(init?.headers as Record<string, string> | undefined),
  };

  let acceptEncoding = "";
  try {
    // headers() está disponível em Route Handlers (runtime Node). Se algum dia
    // esta função for chamada fora de um contexto de request, degrada sem gzip.
    const h = await headers();
    acceptEncoding = (h.get("accept-encoding") ?? "").toLowerCase();
  } catch {}

  if (acceptEncoding.includes("gzip") || acceptEncoding.includes("*")) {
    try {
      const gz = gzipSync(Buffer.from(json), { level: 6 });
      return new Response(new Uint8Array(gz), {
        ...init,
        headers: { ...baseHeaders, "Content-Encoding": "gzip" },
      });
    } catch {
      // falhou a compressão (payload gigante/memória) → cai pro plano cru
    }
  }
  return new Response(json, { ...init, headers: baseHeaders });
}

/** JSON comprimido SEM cache público — para rotas sensíveis a sessão/cookies
 *  (ex.: /api/works, que responde diferente na zona adulta). Comprime igual,
 *  mas o navegador não reusa entre usuários e o servidor revalida sempre. */
export async function gzipJson(data: any, init?: ResponseInit) {
  const json = JSON.stringify(data);
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "private, no-cache",
    Vary: "Accept-Encoding, Cookie",
    ...(init?.headers as Record<string, string> | undefined),
  };
  let acceptEncoding = "";
  try {
    const h = await headers();
    acceptEncoding = (h.get("accept-encoding") ?? "").toLowerCase();
  } catch {}
  if (acceptEncoding.includes("gzip") || acceptEncoding.includes("*")) {
    try {
      const gz = gzipSync(Buffer.from(json), { level: 6 });
      return new Response(new Uint8Array(gz), {
        ...init,
        headers: { ...baseHeaders, "Content-Encoding": "gzip" },
      });
    } catch {}
  }
  return new Response(json, { ...init, headers: baseHeaders });
}

/** Cache CURTO (30s) para dados que mudam rápido (hype, notícias, sections).
 *  O browser ainda reusa na navegação interna, mas um F5 pega dado NOVO em
 *  até 30s — antes, max-age 120 + SWR 600 mantinha conteúdo velho até 12min. */
export async function cachedVolatile(data: any, init?: ResponseInit) {
  return cachedJson(data, 30, init);
}
