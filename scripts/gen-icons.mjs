// Ícones oficiais do PWA OtakuVerse — gerados POR CÓDIGO (sharp + SVG),
// com a identidade exata do site: gradiente da marca (#2563eb→#0ea5e9, o mesmo
// --ov-brand-grad do tema azul) + lua e estrela (a linguagem do MoonStar do header).
// Nada de imagem de IA, nada de placeholder — vetores da própria identidade.
import sharp from "sharp";

const defs = `
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#0ea5e9"/>
    </linearGradient>
    <mask id="m">
      <rect width="512" height="512" fill="#fff"/>
      <circle cx="330" cy="210" r="110" fill="#000"/>
    </mask>`;

// crescente (lua) + estrela de 4 pontas — mesmas formas do botão de logo do site
const moonStar = `
  <circle cx="250" cy="272" r="126" fill="#ffffff" mask="url(#m)"/>
  <path d="M356 246 L371 283 L408 298 L371 313 L356 350 L341 313 L304 298 L341 283 Z" fill="#ffffff"/>`;

const wrap = (inner, rx) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><defs>${defs}</defs><rect width="512" height="512" rx="${rx}" fill="url(#g)"/>${inner}</svg>`;
const scale = (s) => `<g transform="translate(256 256) scale(${s}) translate(-256 -256)">${moonStar}</g>`;

const out = [
  ["icon-512.png", wrap(moonStar, 112), 512],
  ["icon-192.png", wrap(moonStar, 112), 192],
  ["maskable-512.png", wrap(scale(0.74), 0), 512],
  ["apple-touch-icon.png", wrap(scale(0.74), 0), 180],
  ["favicon-32.png", wrap(moonStar, 96), 32],
  ["favicon-48.png", wrap(moonStar, 96), 48],
];

for (const [name, svg, size] of out) {
  await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`public/icons/${name}`);
  console.log("✓ public/icons/" + name);
}
console.log("Ícones PWA gerados.");
