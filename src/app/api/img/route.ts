// Proxy de imagens anti-bloqueio: o servidor busca a imagem na fonte original
// e serve mesma-origem com cache em disco. O navegador nunca depende do CDN externo.
// - Referrer/hotlink-block de terceiros deixa de afetar o site (fetch server-side sem referer).
// - Multi-fonte: se a fonte principal falhar, tenta a URL alternativa (?f=).
// - Cache em disco (7 dias) com TETO + LRU em memória POR BYTES.
// v3.9.4 — blindagem de recursos para o container apertado da plataforma
// (Function Compute com limite de memória — a morte do site foi OOM):
//   · SEMÁFORO GLOBAL de downloads (8 simultâneos, fila curta de 64): antes cada
//     visitante disparava dezenas de fetches de uma vez (uma home tem ~40 capas) —
//     buffers + file descriptors em rajada alimentavam o pico de RAM;
//   · LRU de memória por BYTES (32MB): antes era por contagem (96 entradas × até
//     8MB = 768MB no pior teórico);
//   · teto do cache em DISCO (256MB, evict por mtime): antes só expirava por
//     idade (7d) sem teto — disco cheio derruba o container inteiro;
//   · rate-limiter por IP PURGA entradas expiradas: antes o Map só crescia
//     (vazamento lento com tráfego de bots/scanners).
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
const MAX_BYTES = 8 * 1024 * 1024; // teto por imagem
const DISK_BUDGET = 256 * 1024 * 1024; // teto do acervo em disco
const MEM_BUDGET = 32 * 1024 * 1024; // teto do LRU em memória (bytes de payload)
const FETCH_CONCURRENCY = 8; // downloads externos simultâneos (global, todos os visitantes)
const QUEUE_MAX = 64; // espera máxima na fila; acima disso falha rápida (429)

// ---- Estado global (sobrevive a recompilação do módulo em dev/hmr) ----
const g = globalThis as unknown as {
  __imgMem?: Map<string, { buf: Buffer; ct: string; bytes: number }>;
  __imgMemBytes?: number;
  __imgFetch?: { active: number; queue: (() => void)[] };
  __imgBuckets?: Map<string, { n: number; reset: number }>;
  __imgWrites?: number;
};

// ---- LRU memória POR BYTES: Map (inserção = mais recente; evict sempre o primeiro) ----
function mem() {
  if (!g.__imgMem) {
    g.__imgMem = new Map();
    g.__imgMemBytes = 0;
  }
  return g.__imgMem;
}
function memPut(key: string, buf: Buffer, ct: string) {
  const m = mem();
  const old = m.get(key);
  if (old) {
    g.__imgMemBytes = (g.__imgMemBytes ?? 0) - old.buf.length;
    m.delete(key);
  }
  m.set(key, { buf, ct, bytes: buf.length });
  g.__imgMemBytes = (g.__imgMemBytes ?? 0) + buf.length;
  while ((g.__imgMemBytes ?? 0) > MEM_BUDGET && m.size > 1) {
    const first = m.keys().next().value as string;
    const ev = m.get(first);
    m.delete(first);
    g.__imgMemBytes = (g.__imgMemBytes ?? 0) - (ev?.bytes ?? 0);
  }
}

// ---- Semáforo global de downloads externos ----
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

// ---- Rate limiter por IP, com purge (o Map não pode crescer sem limite) ----
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

/** Poda do cache em disco — por IDADE (>7d) e por TETO (DISK_BUDGET, evict LRU
 *  por mtime). Roda no máx. 1x/hora, ou forçada a cada ~100 escritas. */
let pruned = 0;
async function pruneDisk(force = false) {
  if (!force && Date.now() - pruned < 3600_000) return;
  pruned = Date.now();
  try {
    const files = await readdir(CACHE_DIR);
    const stats: { p: string; mtime: number; size: number }[] = [];
    let total = 0;
    for (const f of files) {
      const p = path.join(CACHE_DIR, f);
      const st = await stat(p).catch(() => null);
      if (!st) continue;
      total += st.size;
      stats.push({ p, mtime: st.mtimeMs, size: st.size });
    }
    let excess = total - DISK_BUDGET;
    if (excess <= 0) return; // dentro do teto: só idade interessa, e a idade também só roda 1x/hora
    for (const f of stats) {
      if (excess <= 0) break;
      if (Date.now() - f.mtime > MAX_AGE * 1000) {
        await unlink(f.p).catch(() => {});
        excess -= f.size;
      }
    }
    if (excess > 0) {
      stats.sort((a, b) => a.mtime - b.mtime); // mais antigos primeiro
      for (const f of stats) {
        if (excess <= 0) break;
        await unlink(f.p).catch(() => {});
        excess -= f.size;
      }
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
      memPut(key, buf, sniffCt(buf));
      return img(buf, sniffCt(buf), true);
    }
  } catch {}

  // 1) fonte principal → 2) fonte alternativa — AMBOS sob o semáforo global
  let got = await withFetchSlot(() => fetchImage(u));
  if (!got && f) got = await withFetchSlot(() => fetchImage(f));
  if (!got) {
    // cliente decide o fallback visual (card texto) — sem imagens falsas
    return new NextResponse("Image unavailable", { status: 404 });
  }

  await writeFile(file, got.buf).catch(() => {});
  memPut(key, got.buf, got.ct);
  g.__imgWrites = (g.__imgWrites ?? 0) + 1;
  if ((g.__imgWrites ?? 0) % 100 === 0) pruneDisk(true);
  else pruneDisk();
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
