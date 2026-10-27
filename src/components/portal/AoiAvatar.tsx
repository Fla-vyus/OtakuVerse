"use client";

// Avatar da Aoi — a waifu do OtakuVerse. Desenhado em SVG puro (elemento de
// interface, não é imagem de obra): cabelo azul (tema do site), expressões
// por humor. Determinístico, leve, sem nenhuma imagem raster fake.

export type AoiMood = "idle" | "happy" | "love" | "thinking" | "tsun" | "wink";

export function AoiAvatar({ mood = "idle", size = 64, className }: { mood?: AoiMood; size?: number; className?: string }) {
  const uid = `aoi-${mood}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={`Aoi (${mood})`}
    >
      <defs>
        <linearGradient id={`${uid}-hair`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7cc4ff" />
          <stop offset="60%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <linearGradient id={`${uid}-face`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff7f2" />
          <stop offset="100%" stopColor="#ffe9df" />
        </linearGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx="50" cy="50" r="49" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${uid}-clip)`}>
        {/* fundo */}
        <circle cx="50" cy="50" r="49" fill="#dbeafe" />
        <circle cx="50" cy="50" r="49" fill={`url(#${uid}-hair)`} opacity="0.18" />

        {/* cabelo de trás */}
        <path d="M50 12 C26 12 18 34 20 56 C21 72 24 84 27 92 L73 92 C76 84 79 72 80 56 C82 34 74 12 50 12 Z" fill={`url(#${uid}-hair)`} />

        {/* rosto */}
        <ellipse cx="50" cy="52" rx="24" ry="26" fill={`url(#${uid}-face)`} />

        {/* franja */}
        <path d="M28 46 C26 26 38 18 50 18 C62 18 74 26 72 46 C66 40 62 34 60 28 C56 38 46 44 34 47 C32 48 30 47 28 46 Z" fill={`url(#${uid}-hair)`} />
        {/* mechas laterais */}
        <path d="M28 44 C26 56 26 66 24 74 L32 74 C31 64 31 54 31 46 Z" fill={`url(#${uid}-hair)`} />
        <path d="M72 44 C74 56 74 66 76 74 L68 74 C69 64 69 54 69 46 Z" fill={`url(#${uid}-hair)`} />

        {/* laço */}
        <path d="M50 18 l-7 -8 3 8 -8 -3 6 6 z" fill="#f472b6" opacity="0.9" />
        <circle cx="47" cy="14" r="3.2" fill="#f472b6" />

        {/* blush */}
        {(mood === "happy" || mood === "love" || mood === "tsun") && (
          <>
            <ellipse cx="34" cy="60" rx="4.5" ry="2.6" fill="#fda4af" opacity="0.7" />
            <ellipse cx="66" cy="60" rx="4.5" ry="2.6" fill="#fda4af" opacity="0.7" />
          </>
        )}

        {/* olhos */}
        {mood === "happy" || mood === "love" ? (
          <>
            <path d="M36 52 q4 -5 8 0" stroke="#1e3a8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
            <path d="M56 52 q4 -5 8 0" stroke="#1e3a8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "wink" ? (
          <>
            <ellipse cx="40" cy="52" rx="3.4" ry="4.6" fill="#1e3a8a" />
            <circle cx="41.2" cy="50.6" r="1.3" fill="#fff" />
            <path d="M56 52 q4 -5 8 0" stroke="#1e3a8a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "thinking" ? (
          <>
            <ellipse cx="40" cy="53" rx="3.2" ry="4.2" fill="#1e3a8a" />
            <circle cx="41" cy="51.8" r="1.2" fill="#fff" />
            <ellipse cx="60" cy="53" rx="3.2" ry="4.2" fill="#1e3a8a" />
            <circle cx="61" cy="51.8" r="1.2" fill="#fff" />
            <path d="M55 45 q5 -2 9 1" stroke="#1e3a8a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        ) : mood === "tsun" ? (
          <>
            <path d="M36 50 l8 2" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" />
            <path d="M64 50 l-8 2" stroke="#1e3a8a" strokeWidth="2" strokeLinecap="round" />
            <ellipse cx="40" cy="55" rx="2.8" ry="3.6" fill="#1e3a8a" />
            <ellipse cx="60" cy="55" rx="2.8" ry="3.6" fill="#1e3a8a" />
            <path d="M34 45 q5 -3 9 -1" stroke="#1e3a8a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M66 45 q-5 -3 -9 -1" stroke="#1e3a8a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          </>
        ) : (
          <>
            <ellipse cx="40" cy="52" rx="3.2" ry="4.4" fill="#1e3a8a" />
            <circle cx="41" cy="50.6" r="1.2" fill="#fff" />
            <ellipse cx="60" cy="52" rx="3.2" ry="4.4" fill="#1e3a8a" />
            <circle cx="61" cy="50.6" r="1.2" fill="#fff" />
          </>
        )}

        {/* boca */}
        {mood === "happy" ? (
          <path d="M45 63 q5 5 10 0" stroke="#be185d" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : mood === "love" ? (
          <path d="M44 62 q6 7 12 0" stroke="#be185d" strokeWidth="2" fill="#f9a8d4" strokeLinecap="round" />
        ) : mood === "tsun" ? (
          <path d="M45 65 q5 -3 10 0" stroke="#be185d" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : mood === "thinking" ? (
          <circle cx="51" cy="64" r="1.8" fill="#be185d" />
        ) : (
          <path d="M46 63 q4 3 8 0" stroke="#be185d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        )}
      </g>

      {/* aro */}
      <circle cx="50" cy="50" r="48.6" fill="none" stroke={`url(#${uid}-hair)`} strokeWidth="2" opacity="0.6" />

      {/* corações no modo love */}
      {mood === "love" && (
        <>
          <text x="76" y="26" fontSize="14" fill="#f472b6">♥</text>
          <text x="10" y="34" fontSize="9" fill="#f472b6" opacity="0.8">♥</text>
        </>
      )}
    </svg>
  );
}
