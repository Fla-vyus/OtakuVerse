import type { NextConfig } from "next";

// NOTA: os headers de segurança (CSP, HSTS, XFO, nosniff, referrer, permissions)
// vivem em UM lugar só: src/proxy.ts (convenção Next 16 que substitui middleware).
// Não recrie aqui — headers duplicados com valores diferentes conflitam no browser.
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
  // v3.8 — Vercel: o snapshot do catálogo entra no bundle de TODAS as funções.
  // É ele que permite o cold start hidratar o pool de 40k obras em segundos,
  // sem precisar puxar tudo do Turso na primeira requisição (~21MB gz por função,
  // folga no limite de 250MB do bundle).
  // v3.9 — otakuverse.runtime.json viaja junto: é a env de runtime do deploy na
  // plataforma (DATABASE_URL/TURSO_AUTH_TOKEN/AI_*), já que ninguém injeta env lá.
  outputFileTracingIncludes: {
    "/**": ["./data/catalog-snapshot.jsonl.gz", "./data/manifest.json", "./otakuverse.runtime.json"],
  },
  // v3.9 — EXCLUSÕES de tracing: o file-tracer copia para o standalone qualquer
  // diretório referenciado por string no código. Isso inchava o payload em ~148MB:
  //   · skills/ (61MB) — skills da plataforma, puxadas pelo trace da instrumentation
  //   · db/ (85MB) — SQLite local; no deploy-Turso o banco é remoto e não viaja
  //   · scripts/ e src/ — código-fonte já bundleado; scripts .ts não rodam no deploy
  // Dev local NÃO é afetado (tracing só vale para o output standalone).
  outputFileTracingExcludes: {
    "/**": ["./skills/**", "./db/**", "./scripts/**", "./src/**", "./tests/**"],
  },
  // Turbopack guarda artefatos de compilação em disco: reiniciar o servidor dev
  // não recomeça do zero — primeira abertura de cada rota continua rápida.
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },
  // preview do sandbox acessa _next/* pelo domínio space-z.ai — autoriza sem warning
  allowedDevOrigins: ["*.space-z.ai"],
  // o indicador "N" do dev mode fica SOBRE a bottom nav no mobile — desligado
  // (é só um atalho de dev; production nunca teve isso)
  devIndicators: false,
};

export default nextConfig;
