import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

/**
 * Cache de imagens em disco — proteção definitiva contra "sumiço" de imagens.
 *
 * Como funciona: em vez de o navegador de cada visitante buscar capas direto nos
 * CDNs (AniList, MangaDex, Kitsu, TVMaze, MAL), o SERVIDOR baixa a imagem uma
 * única vez, guarda em disco e serve localmente. Benefícios:
 *  - Rate limit / hotlink protection / bloqueio regional dos CDNs nunca mais
 *    afeta o visitante (o servidor re-tenta e mantém o acervo).
 *  - Uma imagem já exibida uma vez fica materializada: mesmo se o CDN sair do ar
 *    depois, o site continua servindo do cache.
 *  - Múltiplas fontes: o cliente mantém a cadeia cover → coverAlts (outros CDNs
 *    oficiais) → tile tipográfico. O proxy é apenas o canal, nunca a fonte fake.
 *
 * Sem imagem gerada/fake: este módulo só serve bytes baixados dos domínios
 * oficiais abaixo (whitelist).
 */

const ALLOWED_HOSTS = new Set([
  "s4.anilist.co", // MyAnimeList/AniList CDN oficial
  "uploads.mangadex.org", // MangaDex CDN oficial
  "media.kitsu.app", // Kitsu CDN oficial
  "static.tvmaze.com", // TVMaze CDN oficial
  "cdn.myanimelist.net", // MAL — thumbs das notícias (RSS oficial)
  "media.myanimelist.net",
  "images.mangaupdates.com", // MangaUpdates — capas editoriais reais (fonte #6)
]);

const CACHE_DIR = path.join(process.cwd(), "db", "imgcache");
const MAX_BYTES = 8 * 1024 * 1024;
const DOWNLOAD_TIMEOUT = 12_000;
const MAX_CONCURRENCY = 6; // respeita rate limits dos CDNs
// Teto do acervo em disco — quando passa, os arquivos mais antigos são podados
// (auto-cura: qualquer imagem podada volta a ser baixada do CDN se precisar).
// Sem isso o disco enche e o SITE INTEIRO fica instável — estabilidade > acervo total.
const MAX_CACHE_BYTES = 4 * 1024 * 1024 * 1024; // 4 GB
const EVICT_CHECK_EVERY = 150; // checa o tamanho a cada 150 downloads

const EXT_BY_CT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 OtakuVerseImageCache/1.0";

export interface CachedImage {
  file: string;
  contentType: string;
}

let dirReady = false;
async function ensureDir() {
  if (!dirReady) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    dirReady = true;
  }
}

function keyFor(u: string) {
  return createHash("sha1").update(u).digest("hex");
}

/** Downloads concorrentes da mesma URL compartilham a mesma Promise. */
const inflight = new Map<string, Promise<CachedImage | null>>();
let downloadCounter = 0;

/** Semáforo global — evita rajadas que disparariam 429 nos CDNs. */
let active = 0;
const waiting: (() => void)[] = [];
async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENCY) await new Promise<void>((r) => waiting.push(r));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function isAllowedImageUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === "https:" && ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/** Fast path: lê o meta e confirma que o arquivo existe em disco. */
async function readFromCache(key: string): Promise<CachedImage | null> {
  try {
    const metaPath = path.join(CACHE_DIR, `${key}.meta`);
    const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as { file: string; ct: string };
    await fs.access(meta.file);
    return { file: meta.file, contentType: meta.ct };
  } catch {
    return null;
  }
}

/** Podar os arquivos mais antigos até voltar dentro do orçamento de disco. */
let lastEvict = 0;
async function evictOldIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastEvict < 60_000) return; // no máx. 1x por minuto
  lastEvict = now;
  try {
    const entries = await fs.readdir(CACHE_DIR);
    let total = 0;
    const files: { name: string; size: number; mtime: number }[] = [];
    for (const name of entries) {
      if (name.endsWith(".meta")) continue;
      const st = await fs.stat(path.join(CACHE_DIR, name)).catch(() => null);
      if (!st) continue;
      total += st.size;
      files.push({ name, size: st.size, mtime: st.mtimeMs });
    }
    if (total <= MAX_CACHE_BYTES) return;
    files.sort((a, b) => a.mtime - b.mtime); // mais antigos primeiro
    let excess = total - MAX_CACHE_BYTES;
    for (const f of files) {
      if (excess <= 0) break;
      const metaKey = f.name.replace(/\.[a-z0-9]+$/i, ".meta");
      await fs.rm(path.join(CACHE_DIR, f.name), { force: true }).catch(() => {});
      await fs.rm(path.join(CACHE_DIR, metaKey), { force: true }).catch(() => {});
      excess -= f.size;
    }
  } catch {
    // nunca deixar a poda derrubar o download
  }
}

async function download(u: string, key: string): Promise<CachedImage | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT);
  try {
    const res = await fetch(u, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8" },
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) throw new Error("tamanho inválido");
    const raw = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const ct = EXT_BY_CT[raw] ? raw : "image/jpeg";
    const file = path.join(CACHE_DIR, key + (EXT_BY_CT[ct] ?? ".jpg"));
    await fs.writeFile(file, buf);
    await fs.writeFile(path.join(CACHE_DIR, `${key}.meta`), JSON.stringify({ file, ct }));
    return { file, contentType: ct };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Garante a imagem em disco e devolve o caminho + content-type.
 * Retorna null se a URL não é permitida ou o download falhou de vez.
 */
export async function cacheRemoteImage(u: string, tries = 2): Promise<CachedImage | null> {
  if (!isAllowedImageUrl(u)) return null;
  const key = keyFor(u);

  await ensureDir();
  const cached = await readFromCache(key);
  if (cached) return cached;

  const running = inflight.get(key);
  if (running) return running;

  const task = (async (): Promise<CachedImage | null> => {
    for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        return await withSlot(() => download(u, key));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const retryable = msg.includes("429") || /HTTP 5\d\d/.test(msg);
        if (attempt < tries && retryable) {
          await new Promise((r) => setTimeout(r, 900));
          continue;
        }
        return null;
      }
    }
    return null;
  })();

  inflight.set(key, task);
  try {
    const result = await task;
    if (result && ++downloadCounter % EVICT_CHECK_EVERY === 0) {
      evictOldIfNeeded().catch(() => {}); // podação sem bloquear o download
    }
    return result;
  } finally {
    inflight.delete(key);
  }
}
