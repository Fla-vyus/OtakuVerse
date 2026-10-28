/**
 * Ingestão do Feed Social — puxa posts de fontes reais e UPserta (nunca apaga).
 *
 * Fontes (testadas e alcançáveis deste ambiente):
 *  - Reddit Atom RSS: r/manga, r/anime, r/LightNovels (pulso da comunidade, threads oficiais de lançamento)
 *  - Kitsu trending API: em alta do dia (manga + anime) → 1 post por obra no top 5
 *
 * Idempotência: id = hash estável (reddit: do link; kitsu: obra+yymmdd) → re-ingestão nunca duplica.
 * Robustez: timeout, retry com backoff, UA próprio (Reddit bloqueia UA genérico), falha de uma fonte não derruba as outras.
 */
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const UA = "OtakuVerseFeedBot/1.0 (portal de descoberta; contato: admin@otakuverse.app)";

const SUBS = ["manga", "anime", "LightNovels"];
const REDDIT_MAX_AGE_MS = 5 * 86400_000; // ignora posts com mais de 5 dias
const KITSU_TOP = 5;

function sha(s: string): string {
  return "r" + createHash("sha256").update(s).digest("hex").slice(0, 20);
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function fetchWithRetry(url: string, tries = 3): Promise<string | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "*/*" }, signal: ctrl.signal });
      clearTimeout(t);
      if (res.status === 429) {
        console.log(`  429 de ${url} — aguardando ${4 + i * 4}s`);
        await new Promise((r) => setTimeout(r, (4 + i * 4) * 1000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e: any) {
      console.log(`  falha ${i + 1}/${tries} em ${url}: ${e.message}`);
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 2_000 * (i + 1)));
    }
  }
  return null;
}

// ---------- mapeamento título → obra do catálogo ----------
let titleMap: Map<string, { id: string; cover: string; coverColor: string | null }> | null = null;
async function getTitleMap() {
  if (titleMap) return titleMap;
  const rows = await db.work.findMany({
    where: { isAdult: false },
    select: { id: true, title: true, titleEn: true, titleNative: true, cover: true, coverColor: true, popularity: true },
    orderBy: { popularity: "desc" },
  });
  const m = new Map<string, { id: string; cover: string; coverColor: string | null }>();
  for (const w of rows) {
    for (const t of [w.title, w.titleEn, w.titleNative]) {
      const n = norm(t ?? "");
      if (n && !m.has(n)) m.set(n, { id: w.id, cover: w.cover, coverColor: w.coverColor });
    }
  }
  titleMap = m;
  return m;
}

/** Extrai o nome da obra de um título de post tipo "[DISC] Kagurabachi Chapter 88" */
function extractWorkName(title: string): string {
  let t = title.replace(/\[[^\]]*\]|\([^)]*\)/g, " "); // remove [flairs] e (parênteses)
  t = t.replace(/\bchapter\b.*$/i, " ").replace(/\bch\.?\s*\d+.*$/i, " ");
  t = t.replace(/\bepisode\b.*$/i, " ").replace(/\bep\.?\s*\d+.*$/i, " ");
  t = t.replace(/\bvol(ume)?\.?\s*\d+.*$/i, " ");
  t = t.replace(/\b—\b.*$/, " ").replace(/\s*-\s*$/, "").replace(/[-–|:]\s*$/, "");
  return t.replace(/\s+/g, " ").trim();
}

function matchWork(title: string, map: Map<string, { id: string; cover: string; coverColor: string | null }>) {
  const name = extractWorkName(title);
  if (name.length < 3) return null;
  return map.get(norm(name)) ?? null;
}

// ---------- Reddit (Atom) ----------
interface RedditEntry { title: string; link: string; updated: number; author: string; snippet: string; thumb: string | null }

function parseAtom(xml: string): RedditEntry[] {
  const out: RedditEntry[] = [];
  const blocks = xml.split(/<entry>/).slice(1);
  for (const b of blocks) {
    const title = stripTags(b.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const link = b.match(/<link[^>]*href="([^"]+)"/)?.[1] ?? "";
    const updated = Date.parse(b.match(/<updated>([\s\S]*?)<\/updated>/)?.[1] ?? "") || 0;
    const author = stripTags(b.match(/<name>([\s\S]*?)<\/name>/)?.[1] ?? "");
    const content = b.match(/<content[^>]*>([\s\S]*?)<\/content>/)?.[1] ?? "";
    const thumb = b.match(/<media:thumbnail[^>]*url="([^"]+)"/)?.[1] ?? null;
    if (title && link) out.push({ title, link: link.split("?")[0], updated, author, snippet: stripTags(content).slice(0, 400), thumb });
  }
  return out;
}

async function ingestReddit(): Promise<number> {
  console.log("▶ Reddit (r/manga, r/anime, r/LightNovels)");
  const map = await getTitleMap();
  let created = 0;
  for (const sub of SUBS) {
    const xml = await fetchWithRetry(`https://www.reddit.com/r/${sub}/.rss?limit=25`);
    if (!xml) { console.log(`  r/${sub}: indisponível agora — pulando (sem dados salvos em risco)`); continue; }
    const entries = parseAtom(xml);
    let subNew = 0;
    for (const e of entries) {
      if (!e.updated || Date.now() - e.updated > REDDIT_MAX_AGE_MS) continue;
      if (e.snippet.length < 8 && !e.thumb) continue;
      const w = matchWork(e.title, map);
      const id = sha(e.link);
      const body = e.snippet || e.title;
      await db.feedPost.upsert({
        where: { id },
        create: {
          id, kind: "official", source: `Reddit · r/${sub}`, handle: e.author || null,
          title: e.title, body, image: e.thumb, url: e.link,
          workId: w?.id ?? null, publishedAt: new Date(e.updated),
        },
        update: {},
      });
      subNew++;
    }
    console.log(`  r/${sub}: ${entries.length} entradas lidas, ${subNew} válidas (novas ou já vistas)`);
    created += subNew;
    await new Promise((r) => setTimeout(r, 2_500)); // respiro entre subs — Reddit é sensível a rajada
  }
  return created;
}

// ---------- Kitsu (trending do dia) ----------
interface KitsuItem { title: string; poster: string | null; subtype: string; popularityRank: number | null }

async function kitsuTrending(kind: "manga" | "anime"): Promise<KitsuItem[]> {
  const raw = await fetchWithRetry(`https://kitsu.app/api/edge/trending/${kind}?limit=10`);
  if (!raw) return [];
  try {
    const j = JSON.parse(raw);
    return (j.data ?? []).map((d: any) => ({
      title: d.attributes?.canonicalTitle ?? d.attributes?.titles?.en ?? "",
      poster: d.attributes?.posterImage?.medium ?? d.attributes?.posterImage?.small ?? null,
      subtype: d.attributes?.subtype ?? kind,
      popularityRank: d.attributes?.popularityRank ?? null,
    })).filter((x: KitsuItem) => x.title);
  } catch { return []; }
}

async function ingestKitsu(): Promise<number> {
  console.log("▶ Kitsu (em alta do dia)");
  const map = await getTitleMap();
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  let created = 0;
  for (const kind of ["manga", "anime"] as const) {
    const items = await kitsuTrending(kind);
    if (!items.length) { console.log(`  kitsu ${kind}: vazio/indisponível — pulando`); continue; }
    let matched = 0;
    for (const it of items.slice(0, KITSU_TOP)) {
      const w = map.get(norm(it.title));
      if (!w) continue; // só publicamos o que existe no nosso catálogo (capa + ver obra reais)
      matched++;
      const label = kind === "manga" ? "mangá" : "anime";
      const pos = it.popularityRank ? ` (#${it.popularityRank} em popularidade na Kitsu)` : "";
      const id = `k${kind}-${w.id}-${day}`;
      const existed = await db.feedPost.findUnique({ where: { id }, select: { id: true } });
      if (existed) continue;
      await db.feedPost.create({
        data: {
          id, kind: "official", source: "Kitsu", handle: "trending diário",
          title: `Em alta agora: ${it.title}`,
          body: `${it.title} está entre os ${label}s mais quentes do momento na Kitsu${pos}. Garimpo do dia feito automaticamente a partir do trending oficial — abra a obra para ver onde acompanhar.`,
          image: w.cover, workId: w.id,
          tags: JSON.stringify([label, "em alta"]),
          publishedAt: new Date(),
        },
      }).catch(() => {}); // corrida entre processos — ignora duplicado
      created++;
    }
    console.log(`  kitsu ${kind}: top ${items.length} lido, ${matched} casaram com o catálogo`);
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return created;
}

async function main() {
  const t0 = Date.now();
  console.log(`=== feed-ingest ${new Date().toISOString()} ===`);
  let reddit = 0, kitsu = 0;
  try { reddit = await ingestReddit(); } catch (e: any) { console.log("Reddit falhou:", e.message); }
  try { kitsu = await ingestKitsu(); } catch (e: any) { console.log("Kitsu falhou:", e.message); }
  const total = await db.feedPost.count();
  const last = await db.feedPost.findFirst({ orderBy: { publishedAt: "desc" }, select: { publishedAt: true } });
  console.log(`✓ ingestão concluída em ${((Date.now() - t0) / 1000).toFixed(1)}s — total na tabela: ${total} posts, mais recente: ${last?.publishedAt?.toISOString?.() ?? "—"}`);
  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
