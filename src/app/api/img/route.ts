// Proxy de imagens — v4.0 (ETAPA 4): SÓ FALLBACK para domínio que bloqueia hotlink.
// O caminho PADRÃO agora é a URL direta do CDN (WorkCard/CoverThumb/DetailView usam
// directCover primeiro). Quando chamado, o proxy é mínimo por exigência de RAM:
//   · SEM cache em disco e SEM cache em memória (nada acumula entre requisições)
//   · semáforo global de 3 downloads simultâneos, fila curta de 24
//   · timeout de 5s por download
//   · rate-limit por IP + allowlist de domínios (nunca proxy aberto)
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FETCH_CONCURRENCY = 3;  // downloads externos simultâneos (global, todos os visitantes)
const QUEUE_MAX = 24;         // espera máxima na fila; acima disso falha rápida (429)
const FETCH_TIMEOUT = 5000;   // 5s por download
const MAX_BYTES = 8 * 1024 * 1024; // teto por imagem

const g = globalThis as unknown as {
  __imgFetch?: { active: number; queue: (() => void)[] };
  __imgBuckets?: Map<string, { n: number; reset: number }>;
};

function fetchSlots() {
  if (!g.__imgFetch) g.__imgFetch = { active: 0, queue: [] };
  return g.__imgFetch;
}
async function withFetchSlot<T>(fn: () => Promise<T>): Promise<T | null> {
  const s = fetchSlots();
  if (s.active >= FETCH_CONCURRENCY) {
    if (s.queue.length >= QUEUE_MAX) return null; // sob pressão: falha rápida — o cliente mostra o card tipográfico
    await new Promise<void>((r) => s.queue.push(r));
  }
  s.active++;
  try {
    return await fn();
  } finally {
    s.active--;
    s.queue.shift()?.();
  }
}

function limited(ip: string): boolean {
  if (!g.__imgBuckets) g.__imgBuckets = new Map();
  const buckets = g.__imgBuckets;
  const now = Date.now();
  if (buckets.size > 4096) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { n: 1, reset: now + 60000 });
    return false;
  }
  b.n++;
  return b.n > 120; // 120 req/min/IP — folga para uma página de capas, freia bots
}

/** Sniff do Content-Type pelos magic bytes (servir WebP como jpeg quebra com nosniff). */
function sniffCt(buf: Buffer): string {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.length > 6 && buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return "application/octet-stream";
}

async function fetchImage(url: string): Promise<{ buf: Buffer; ct: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OtakuVerseBot/2.0; +https://otakuverse.app)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        // sem referer de propósito: evita bloqueio por hotlink-referrer
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_BYTES) return null;
    return { buf: Buffer.from(ab), ct };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return new NextResponse("Too Many Requests", { status: 429 });

  const u = req.nextUrl.searchParams.get("u");
  const f = req.nextUrl.searchParams.get("f"); // fonte alternativa
  if (!u) return new NextResponse("Missing u", { status: 400 });
  if (!/^https?:\/\//i.test(u) || (f && !/^https?:\/\//i.test(f))) return new NextResponse("Bad URL", { status: 400 });
  // só permitimos imagens de fontes conhecidas (evita uso como proxy aberto)
  const ALLOW = /(^|\.)anilist\.co$|(^|\.)kitsu\.(io|app|moe)$|(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$|(^|\.)mangaupdates\.com$|(^|\.)myanimelist\.net$|(^|\.)redd\.it$|(^|\.)imgur\.com$|(^|\.)ytimg\.com$|(^|\.)googleusercontent\.com$|(^|\.)cdn\.[a-z0-9-]+\.(net|com|org)$/i;
  try {
    const hu = new URL(u).hostname;
    if (!ALLOW.test(hu)) return new NextResponse("Source not allowed", { status: 403 });
    if (f) {
      const hf = new URL(f).hostname;
      if (!ALLOW.test(hf)) return new NextResponse("Fallback not allowed", { status: 403 });
    }
  } catch {
    return new NextResponse("Bad URL", { status: 400 });
  }

  // fonte principal → fonte alternativa, AMBOS sob o semáforo global (3) e timeout 5s
  let got = await withFetchSlot(() => fetchImage(u));
  if (!got && f) got = await withFetchSlot(() => fetchImage(f));
  if (!got) {
    // cliente decide o fallback visual (card texto) — sem imagens falsas
    return new NextResponse("Image unavailable", { status: 404 });
  }
  const ct = got.ct === "application/octet-stream" ? sniffCt(got.buf) : got.ct;
  return new NextResponse(new Uint8Array(got.buf), {
    status: 200,
    headers: {
      "Content-Type": ct,
      // o navegador pode cachear à vontade — o SERVIDOR não guarda nada
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
