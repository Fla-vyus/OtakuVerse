// Proxy de imagens anti-bloqueio: o servidor busca a imagem na fonte original
// e serve mesma-origem com cache em disco. O navegador nunca depende do CDN externo.
// - Referrer/hotlink-block de terceiros deixa de afetar o site (fetch server-side sem referer).
// - Multi-fonte: se a fonte principal falhar, tenta a URL alternativa (?f=).
// - Cache em disco (7 dias) + LRU em memória para arquivos quentes.
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat, readdir, unlink } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

// Portátil v3.7.4: nada de caminho absoluto — env IMG_CACHE_DIR > OTAKUVERSE_ROOT
// (padrão v3.7.2 dos jobs) > cwd. Em produção os scripts exportam OTAKUVERSE_ROOT,
// então o comportamento é idêntico ao anterior; em outros ambientes cai no cwd.
const CACHE_DIR =
  process.env.IMG_CACHE_DIR ||
  path.join(process.env.OTAKUVERSE_ROOT || process.cwd(), ".imgcache");
const MAX_AGE = 7 * 86400; // 7 dias
const MAX_BYTES = 8 * 1024 * 1024;

// LRU memória (96 entradas) — guarda {buf, ct} para responder o tipo certo
const g = globalThis as unknown as { __imgMem?: Map<string, { buf: Buffer; ct: string }> };
function mem() {
  if (!g.__imgMem) g.__imgMem = new Map();
  return g.__imgMem;
}

const buckets = new Map<string, { n: number; reset: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip);
  if (!b || b.reset < now) {
    buckets.set(ip, { n: 1, reset: now + 60000 });
    return false;
  }
  b.n++;
  return b.n > 300; // 300 req/min/IP — folga para uma página cheia de capas
}

/** Sniff do Content-Type pelos magic bytes — o cache em disco não guarda o ct,
 *  e servir WebP/PNG como image/jpeg com X-Content-Type-Options: nosniff
 *  pode renderizar quebrado (thumbs do Reddit chegam como WebP). */
function sniffCt(buf: Buffer): string {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length > 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (buf.length > 6 && buf.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  return "application/octet-stream";
}

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex").slice(0, 40);
}

let pruned = 0;
async function pruneDisk() {
  if (Date.now() - pruned < 3600_000) return;
  pruned = Date.now();
  try {
    const files = await readdir(CACHE_DIR);
    for (const f of files) {
      const p = path.join(CACHE_DIR, f);
      const st = await stat(p).catch(() => null);
      if (st && Date.now() - st.mtimeMs > MAX_AGE * 1000) await unlink(p).catch(() => {});
    }
  } catch {}
}

async function fetchImage(url: string): Promise<{ buf: Buffer; ct: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OtakuVerseBot/2.0; +https://otakuverse.app)",
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        // sem referer de propósito: evita bloqueio por hotlink-referrer
      },
      signal: AbortSignal.timeout(9000),
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
  // redd.it: thumbs do Feed Social (preview/external-preview/i.redd.it)
  // imgur/ytimg/googleusercontent: imagens e thumbs usados por posts e páginas oficiais
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

  const key = sha(u);
  const m = mem();
  const hit = m.get(key);
  if (hit) return img(hit.buf, hit.ct, true);

  await mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
  const file = path.join(CACHE_DIR, key);
  try {
    const st = await stat(file);
    if (st.size > 0 && Date.now() - st.mtimeMs < MAX_AGE * 1000) {
      const buf = await readFile(file);
      const entry = { buf, ct: sniffCt(buf) };
      if (m.size > 96) m.delete(m.keys().next().value as string);
      m.set(key, entry);
      return img(buf, entry.ct, true);
    }
  } catch {}

  // 1) fonte principal → 2) fonte alternativa
  let got = await fetchImage(u);
  if (!got && f) got = await fetchImage(f);
  if (!got) {
    // cliente decide o fallback visual (card texto) — sem imagens falsas
    return new NextResponse("Image unavailable", { status: 404 });
  }

  await writeFile(file, got.buf).catch(() => {});
  if (m.size > 96) m.delete(m.keys().next().value as string);
  m.set(key, got);
  pruneDisk();
  return img(got.buf, got.ct, false);
}

function img(buf: Buffer, ct: string, cached: boolean) {
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": ct,
      "Cache-Control": `public, max-age=${MAX_AGE}, stale-while-revalidate=86400`,
      "X-Img-Cache": cached ? "hit" : "miss",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
