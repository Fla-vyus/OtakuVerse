// Service Worker do OtakuVerse (PWA) — v1
//
// Estratégia por tipo de recurso (SÓ GET — POST/PUT/DELETE passam direto):
//   1. Estáticos imutáveis (_next/static, icons, fonts)      → cache-first (pra sempre)
//   2. Capas via proxy /api/img?u=…                          → cache-first com TETO de 300
//      (centenas de capas repetidas abrem na hora — o ganho real do celular)
//   3. APIs públicas de leitura (sections/hype/news/works/…)  → network-first com fallback cache
//      (conteúdo fresco quando há rede; a última resposta serve quando o servidor pisou)
//   4. Navegação (document)                                   → network-first → cache → offline
//   5. NUNCA cacheia: autenticação, conta, nuvem, biblioteca, IA, cron (dados sensíveis/mutáveis)
//
// Versionamento: ao mudar o schema de cache, suba CACHE_VERSION — o activate apaga o antigo.
const CACHE_VERSION = "ov-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const IMG_CACHE = `${CACHE_VERSION}-img`;
const API_CACHE = `${CACHE_VERSION}-api`;
const IMG_MAX = 300;

// rotas de API que TÊM permissão de cache (leitura pública, sem dado de usuário)
const API_ALLOWLIST = [
  "/api/sections", "/api/hype", "/api/news", "/api/sales", "/api/magazines",
  "/api/streaming", "/api/schedule", "/api/works", "/api/discover",
  "/api/rankings", "/api/pulse", "/api/status", "/api/health",
];
// prefixos que NUNCA passam pelo cache (sensíveis ou mutáveis)
const API_NEVER = [
  "/api/auth", "/api/account", "/api/ai", "/api/cloud", "/api/library",
  "/api/shelf", "/api/lists", "/api/cron", "/api/sync", "/api/profile",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll(["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"]).catch(() => {});
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(CACHE_VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

// teto LRU simples: estourou? apaga o mais antigo e segue
async function putCapped(cacheName, request, response, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length >= max) {
    // remove ~10% dos mais antigos de uma vez (barato e evita trim a cada request)
    for (const k of keys.slice(0, Math.ceil(max / 10))) await cache.delete(k);
  }
  await cache.put(request, response);
}

async function handleImage(request) {
  const cached = await caches.match(request, { cacheName: IMG_CACHE });
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res.ok && (res.headers.get("content-type") || "").startsWith("image/")) {
      await putCapped(IMG_CACHE, request, res.clone(), IMG_MAX);
    }
    return res;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

async function handleApi(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  if (API_NEVER.some((p) => path.startsWith(p))) return fetch(request);
  if (!API_ALLOWLIST.some((p) => path.startsWith(p))) return fetch(request);
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = await caches.match(request);
    if (cached) return cached; // servidor pisou → última boa resposta (o site continua navegável)
    throw e;
  }
}

async function handleDocument(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, res.clone()).catch(() => {});
    }
    return res;
  } catch (e) {
    const cached = (await caches.match(request)) || (await caches.match("/"));
    if (cached) return cached;
    return new Response(
      "<!doctype html><html lang='pt-BR'><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>OtakuVerse — offline</title><body style='margin:0;display:grid;place-items:center;min-height:100vh;background:#0a1120;color:#e6edf8;font-family:system-ui,sans-serif;text-align:center'><div><div style='font-size:44px'>🌙</div><h1 style='font-size:20px'>Você está offline</h1><p style='opacity:.7;font-size:14px;max-width:34ch'>O OtakuVerse volta quando a internet voltar — suas bibliotecas e favoritos continuam salvos.</p></div></body></html>",
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // só mesma origem

  try {
    if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
      event.respondWith(handleDocument(req));
      return;
    }
    if (url.pathname === "/api/img") {
      event.respondWith(handleImage(req));
      return;
    }
    if (url.pathname.startsWith("/api/")) {
      event.respondWith(handleApi(req));
      return;
    }
    if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
      event.respondWith(
        (async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(req, res.clone()).catch(() => {});
          }
          return res;
        })()
      );
      return;
    }
    // demais (ex.: /favicon.ico, rotas de página): rede com fallback cache
    event.respondWith(
      (async () => {
        try {
          return await fetch(req);
        } catch {
          const cached = await caches.match(req);
          if (cached) return cached;
          throw new Error("offline e sem cache");
        }
      })()
    );
  } catch {
    // qualquer surpresa no SW NUNCA derruba a página — deixa a rede resolver
  }
});
