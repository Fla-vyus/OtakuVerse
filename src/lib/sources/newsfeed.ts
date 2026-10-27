// Notícias REAIS: MyAnimeList News RSS (https://myanimelist.net/rss/news.xml)
// — manchetes, resumos, links e FOTOS reais (media:thumbnail do CDN do MAL).
// Cache persistente em banco: se o feed cair, as últimas notícias reais continuam no ar.

import { db } from "@/lib/db";
import { MD_UA } from "./mangadex";
import { brokerFetch } from "../broker";

export type NewsCategory = "anuncios" | "adaptacoes" | "mangas" | "vendas" | "doramas" | "industria";

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: NewsCategory;
  categoryLabel: string;
  image: string | null; // foto REAL da notícia (CDN MyAnimeList)
  url: string; // link real do artigo
  source: string;
  minutesAgo: number;
  publishedAt: string;
  workRef: { id: string; title: string; cover: string; type: string } | null;
}

export const NEWS_CATEGORIES: { key: NewsCategory; label: string }[] = [
  { key: "anuncios", label: "Anúncios" },
  { key: "adaptacoes", label: "Animes & Adaptações" },
  { key: "mangas", label: "Mangás & Manhwas" },
  { key: "vendas", label: "Vendas & Rankings" },
  { key: "doramas", label: "Doramas & Live-Action" },
  { key: "industria", label: "Indústria" },
];

const FEED_URL = "https://myanimelist.net/rss/news.xml";
const REFRESH_MS = 90 * 60 * 1000; // 90 min

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ");
}

function tagContent(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1].trim() : null;
}

function categorize(title: string): NewsCategory {
  const t = title.toLowerCase();
  if (/(live[- ]action|drama series|drama adaptation|dorama|remake)/.test(t)) return "doramas";
  if (/(anime|season (2|3|4|5|premiere|debut)|episode|pv|trailer|promo|key visual|cast|ova|film|movie|blu-?ray|dub|stream)/.test(t)) return "adaptacoes";
  if (/(volume sales|copies|comiket|circulation|sells|ranking|best-?sell)/.test(t)) return "vendas";
  if (/(manga|manhwa|webtoon|one[- ]shot|serialization|magazine|new chapter|concludes|ends in|launches new)/.test(t)) return "mangas";
  if (/(announces|reveal|unveil|confirms|launches|opens|partners|award|collab)/.test(t)) return "anuncios";
  return "industria";
}

function parseFeed(xml: string): Omit<NewsItem, "categoryLabel" | "workRef">[] {
  const items = xml.split(/<item>/).slice(1);
  const out: Omit<NewsItem, "categoryLabel" | "workRef">[] = [];
  for (const raw of items) {
    const item = raw.split("</item>")[0];
    const title = decodeEntities(tagContent(item, "title") ?? "");
    const link = decodeEntities(tagContent(item, "link") ?? "");
    const pubDate = tagContent(item, "pubDate") ?? "";
    const thumb =
      item.match(/<media:thumbnail[^>]*>([\s\S]*?)<\/media:thumbnail>/i)?.[1]?.trim() ??
      item.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ??
      item.match(/<media:content[^>]+url="([^"]+)"/i)?.[1] ??
      null;
    let desc = decodeEntities(tagContent(item, "description") ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    // corta resumo no último espaço antes de 260 chars (não quebra palavra)
    if (desc.length > 260) desc = desc.slice(0, 260).replace(/\s+\S*$/, "") + "…";
    const ts = pubDate ? new Date(pubDate).getTime() : Date.now();
    if (!title || !link) continue;
    out.push({
      id: link.split("?")[0].split("/").pop() ?? link,
      title,
      summary: desc || "Confira os detalhes completos na notícia original do MyAnimeList.",
      category: categorize(title),
      image: thumb,
      url: link,
      source: "MyAnimeList News",
      minutesAgo: Math.max(1, Math.floor((Date.now() - ts) / 60000)),
      publishedAt: new Date(ts).toISOString(),
    });
  }
  return out;
}

export interface NewsResult {
  items: NewsItem[];
  fetchedAt: number;
  live: boolean; // true = acabou de buscar do feed; false = cache do banco
}

/** Casamento de notícia com obra do catálogo (título real contido na manchete) */
let titleIndexCache: { at: number; data: { id: string; title: string; norm: string; cover: string; type: string }[] } | null = null;

function normTitle(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

async function matchWorks(items: Omit<NewsItem, "categoryLabel" | "workRef">[]): Promise<NewsItem[]> {
  if (!titleIndexCache || Date.now() - titleIndexCache.at > 10 * 60 * 1000) {
    const rows = await db.work.findMany({
      where: { isAdult: false },
      orderBy: { popularity: "desc" },
      take: 2500,
      select: { id: true, title: true, titleEn: true, cover: true, type: true },
    });
    const data = rows
      .filter((r) => r.cover)
      .map((r) => {
        const candidates = [r.title, r.titleEn].filter(Boolean) as string[];
        return candidates.map((t) => ({ id: r.id, title: t, norm: normTitle(t), cover: r.cover, type: r.type }));
      })
      .flat()
      .filter((x) => x.norm.length >= 5);
    titleIndexCache = { at: Date.now(), data };
  }
  const idx = titleIndexCache.data;
  return items.map((n) => {
    const nTitle = normTitle(n.title);
    let ref: NewsItem["workRef"] = null;
    for (const cand of idx) {
      if (nTitle.includes(cand.norm)) {
        ref = { id: cand.id, title: cand.title, cover: cand.cover, type: cand.type };
        break;
      }
    }
    return { ...n, workRef: ref, categoryLabel: NEWS_CATEGORIES.find((c) => c.key === n.category)?.label ?? "Indústria" };
  });
}

/** Busca o feed do MAL através do BROKER (fonte dedicada malrss) */
async function fetchFeed(): Promise<Omit<NewsItem, "categoryLabel" | "workRef">[] | null> {
  const r = await brokerFetch("malrss", FEED_URL, {
    headers: { "User-Agent": MD_UA, Accept: "application/rss+xml,application/xml" },
    timeoutMs: 20_000,
  });
  if (!r.data || !r.data.ok) return null;
  try {
    const xml = await r.data.text();
    const parsed = parseFeed(xml);
    return parsed.length ? parsed : null;
  } catch {
    return null;
  }
}

/** API principal: notícias reais com imagens reais, cache persistente */
export async function getNews(limit = 40, forceRefresh = false): Promise<NewsResult> {
  const cacheRow = await db.newsCache.findUnique({ where: { id: "mal-rss" } }).catch(() => null);
  const cachedAt = cacheRow?.fetchedAt ?? 0;
  const fresh = cacheRow && Date.now() - cachedAt * 1000 < REFRESH_MS;

  if (!fresh || forceRefresh) {
    const parsed = await fetchFeed();
    if (parsed && parsed.length) {
      const items = await matchWorks(parsed);
      await db.newsCache.upsert({
        where: { id: "mal-rss" },
        create: { id: "mal-rss", fetchedAt: Math.floor(Date.now() / 1000), items: JSON.stringify(items) },
        update: { fetchedAt: Math.floor(Date.now() / 1000), items: JSON.stringify(items) },
      }).catch(() => {});
      return { items: items.slice(0, limit), fetchedAt: Math.floor(Date.now() / 1000), live: true };
    }
    // feed falhou: serve cache antigo (nunca fica sem notícia real)
    if (cacheRow) {
      const items = JSON.parse(cacheRow.items) as NewsItem[];
      return { items: items.slice(0, limit), fetchedAt: cachedAt, live: false };
    }
    return { items: [], fetchedAt: 0, live: false };
  }

  const items = JSON.parse(cacheRow!.items) as NewsItem[];
  return { items: items.slice(0, limit), fetchedAt: cachedAt, live: false };
}
