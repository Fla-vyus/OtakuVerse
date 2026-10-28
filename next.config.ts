import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  compress: true,
  poweredByHeader: false,
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
