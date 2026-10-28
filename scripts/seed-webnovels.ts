// Catálogo de WEBNOVELS — fonte REAL e GRATUITA: MangaUpdates API v1
// (api.mangaupdates.com — sem chave, sem custo, igual AniList/Kitsu).
//
// O que é uma web novel: romance publicado online em capítulos (Royal Road,
// Wuxiaworld, Kakao/Naver Series, Syosetu). O MangaUpdates é O banco editorial
// dessas obras — type "Novel" + gênero "Web Novel" isola o acervo certo
// (Overgeared Novel, Omniscient Reader's Viewpoint Novel, Shadow Slave…).
//
// Modos:
//   (default)   import completo: ~60 termos de busca × até 3 páginas de 25 →
//               dedupe → só com capa → top N por votos → CREATE-ONLY no banco
//   --topup     diário (jobs.ts): 8 termos aleatórios (novos títulos, create-only)
//               + enriquece 150 webnovels sem status (GET /series/{id}: status, authors)
//   --enrich N  enriquece N registros agora
//   --status    imprime contagens e sai
//
// GARANTIAS: aditivo (nunca apaga, nunca rebaixa gating), idempotente (rerodar
// continua), respeita a fonte (1.1s entre requests + UA próprio), sem imagens
// inventadas (só capas reais do cdn.mangaupdates.com, já permitido no /api/img).
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const UA = "OtakuVerse/1.0 (catalog portal; contact: otakuverse@proton.me)";
const API = "https://api.mangaupdates.com/v1";
const GAP_SEARCH = 1_100;
const GAP_ENRICH = 700;
const MAX_IMPORT = Number(process.env.WN_MAX ?? 4500);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Títulos alternativos no MangaUpdates — a famosa existe, mas sob outro nome
const FAMOUS_ALIASES: Record<string, string[]> = {
  "Reverend Insanity": ["Gu Daoist Master"],
  "Solo Leveling": ["I Alone Level Up"],
  "Tensei Shitara Slime Datta Ken": ["That Time I Got Reincarnated as a Slime"],
  "Re:Zero": ["Re:Zero Kara Hajimeru Isekai Seikatsu"],
  "Lord of the Mysteries": ["Lord of Mysteries"],
};

function normT(s: string): string {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/\u0300-\u036f/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

const TERMS = [
  // TÍTULOS FAMOSOS (busca direta — a busca por letra não alcança tudo; o acervo
  // de qualidade conhecido não pode depender de sorte na paginação)
  "Overgeared","Shadow Slave","The Beginning After The End","Lord of the Mysteries",
  "Reverend Insanity","Warlock of the Magus World","Release That Witch","Against the Gods",
  "Martial God Asura","Battle Through the Heavens","The Legendary Mechanic",
  "Trash of the Count's Family","Omniscient Reader's Viewpoint","Second Life Ranker",
  "The Novel's Extra","Solo Leveling","Tensei Shitara Slime Datta Ken","Re:Zero",
  "Overlord","Arifureta","Ascendance of a Bookworm","Kuma Kuma Kuma Bear",
  "Mushoku Tensei","Coiling Dragon","I Shall Seal the Heavens","A Will Eternal",
  "The Great Ruler","Wu Dong Qian Kun","Tales of Herding Gods","Forty Millenniums of Cultivation",
  "Kin no Kutsuwa","Ore no Kanojo to Osananajimi ga Shuraba Sugiru","Youjo Senki",
  "Slime Tensei","Rakudai Kishi no Cavalry","High School DxD","Seirei Gensouki",
  "Moto Sekai Ichi'i Subchara","Tsuki ga Michibiku Isekai Douchuu","Katahane no Riku",
  "The Legendary Moonlight Sculptor","Emperor of Solo Play","Duke Pendragon",
  "Main Character Hides His Strength","The Tutorial Is Too Hard","SSS-Class Suicide Hunter",
  "The World After the Fall","Tale of a Scribe Who Retires to the Countryside",
  // letras de alta incidência em títulos
  "a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","r","s","t","w","y",
  // palavras-chave do gênero (KR/CN/JP/EN)
  "the","my","i","no","love","world","hero","game","magic","sword","reborn","life",
  "king","academy","system","tower","dungeon","hunter","cultivation","villainess",
  "isekai","reincarnated","regressor","dragon","emperor","martial","god","star",
  "moon","night","blood","dark","queen","prince","duke","beast","boss","survival",
  "apocalypse","level","guild","mage","knight","demon","heaven","ranker","player",
  "constellation","doctor","chaebol","werewolf","mermaid","phoenix","immortal",
];

interface MuSearchRecord {
  series_id: number | string;
  title?: string;
  url?: string;
  description?: string | null;
  image?: { url?: { original?: string; thumb?: string } | null } | null;
  type?: string | null;
  year?: string | null;
  bayesian_rating?: number | string | null;
  rating_votes?: number | null;
  genres?: { genre?: string | null }[] | null;
  last_updated?: { timestamp?: number } | null;
}

interface MuDetail extends MuSearchRecord {
  status?: string | null;
  authors?: { name?: string; type?: string }[] | null;
  categories?: { category?: string }[] | null;
}

async function muSearch(term: string, page: number, genreless = false): Promise<MuSearchRecord[]> {
  const res = await fetch(`${API}/series/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify(
      genreless
        ? { search: term, type: ["Novel"], per_page: 25, page } // sem gênero: títulos famosos que o MU não marcou como "Web Novel"
        : { search: term, type: ["Novel"], genres: ["Web Novel"], per_page: 25, page }
    ),
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`search HTTP ${res.status}`);
  const json: any = await res.json();
  if (json?.status === "exception") throw new Error(`search: ${json?.reason ?? "erro"}`);
  return (json?.results ?? []).map((r: any) => r?.record).filter(Boolean) as MuSearchRecord[];
}

async function muDetail(id: string): Promise<MuDetail | null> {
  const res = await fetch(`${API}/series/${id}`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`detail HTTP ${res.status}`);
  return (await res.json()) as MuDetail;
}

function mapStatus(raw?: string | null): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s.includes("complete")) return "FINISHED";
  if (s.includes("ongoing") || s.includes("releas") || s.includes("serializ")) return "RELEASING";
  if (s.includes("hiatus")) return "HIATUS";
  if (s.includes("dropped") || s.includes("cancel") || s.includes("discontinu")) return "CANCELLED";
  return null;
}

function classify(genres: string[]): { classification: string; spicy: number; isAdult: boolean } {
  const g = genres.map((x) => x.toLowerCase());
  if (g.includes("hentai")) return { classification: "adult", spicy: 2, isAdult: true };
  if (g.includes("erotica") || g.includes("smut") || g.includes("mature")) return { classification: "suggestive", spicy: 1, isAdult: false };
  return { classification: "safe", spicy: 0, isAdult: false };
}

function toRow(rec: MuDetail) {
  const genres = (rec.genres ?? []).map((g) => g.genre ?? "").filter(Boolean);
  const authors = (rec.authors ?? [])
    .filter((a) => a?.name)
    .map((a) => ({ name: a.name!, role: a.type === "Artist" ? "Artist" : "Author" }));
  const rating = rec.bayesian_rating != null ? Number(rec.bayesian_rating) : null;
  const votes = rec.rating_votes ?? 0;
  const chapterMatch = /^(\d+)\s*chap/i.exec(rec.status ?? "");
  const cls = classify(genres);
  const cover = rec.image?.url?.original ?? rec.image?.url?.thumb ?? "";
  const title = (rec.title ?? "").replace(/\s*\(novel\)\s*$/i, "").trim() || (rec.title ?? "").trim();
  return {
    id: `mu-${rec.series_id}`,
    type: "webnovel",
    format: "Web Novel",
    title,
    titleEn: null,
    synopsis: rec.description ? rec.description.slice(0, 6000) : null,
    cover,
    genres: JSON.stringify(genres),
    tags: "[]",
    ptTags: "[]",
    avgScore: rating && rating > 0 ? Math.round(rating * 10) : null,
    popularity: votes,
    favourites: null,
    status: mapStatus(rec.status),
    chapters: chapterMatch ? Number(chapterMatch[1]) : null,
    startDate: rec.year ? `${rec.year}-01-01` : null,
    authors: authors.length ? JSON.stringify(authors) : null,
    source: "MangaUpdates",
    siteUrl: rec.url ?? null,
    lastUpdate: rec.last_updated?.timestamp ?? null,
    ...cls,
  };
}

async function existingMuIds(): Promise<Set<string>> {
  const rows = await db.work.findMany({ where: { id: { startsWith: "mu-" } }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

async function importFull(famousOnly = false) {
  const have = await existingMuIds();
  console.log(`[webnovels] banco já tem ${have.size} mu-* — importando (create-only${famousOnly ? ", só famosas" : ""})…`);
  const candidates = new Map<string, MuSearchRecord>();
  let terms = famousOnly ? TERMS.filter((t) => t.length > 3) : [...TERMS];
  let reqs = 0;
  for (const term of terms) {
    const maxPage = famousOnly ? 2 : term.length <= 3 ? 4 : 2;
    // FAMOSAS: busca SEM filtro de gênero (type Novel) e guarda por contenção de nome —
    // pega títulos que o MU não marcou como "Web Novel" (ex.: Lord of Mysteries)
    // + apelidos conhecidos (ex.: Reverend Insanity = "Gu Daoist Master" no MU)
    if (famousOnly) {
      const aliases = [term, ...(FAMOUS_ALIASES[term] ?? [])];
      try {
        const list = await muSearch(term, 1, true);
        reqs++;
        const normTerms = aliases.map(normT);
        for (const rec of list) {
          const nt = normT(rec.title ?? "");
          if (normTerms.some((n) => nt.includes(n) || n.includes(nt)) && rec.image?.url?.original) {
            candidates.set(String(rec.series_id), rec);
          }
        }
      } catch {
        // segue
      }
      await sleep(GAP_SEARCH);
      continue;
    }
    for (let page = 1; page <= maxPage; page++) {
      let list: MuSearchRecord[] = [];
      try {
        list = await muSearch(term, page);
      } catch (e: any) {
        console.warn(`[webnovels] busca "${term}" p${page} falhou: ${e.message} — segue`);
        break;
      }
      reqs++;
      for (const rec of list) {
        const key = String(rec.series_id);
        if (!candidates.has(key) && rec.image?.url?.original) candidates.set(key, rec);
      }
      if (list.length < 25) break; // última página deste termo
      await sleep(GAP_SEARCH);
    }
    console.log(`[webnovels] "${term}": ${candidates.size} candidatos únicos até agora`);
    await sleep(GAP_SEARCH);
  }
  // qualidade: com capa (garantido acima) + título; ordena por votos (proxy honesto de relevância)
  // famosas buscadas por nome têm prioridade de vaga (não competem com a cauda por votos)
  const famousSet = new Set(TERMS.filter((t) => t.length > 3).map((t) => t.toLowerCase()));
  const ordered = [...candidates.values()]
    .filter((r) => (r.title ?? "").trim())
    .sort((a, b) => {
      const fa = famousSet.has((a.title ?? "").toLowerCase().split(/[:(]/)[0].trim()) ? 1 : 0;
      const fb = famousSet.has((b.title ?? "").toLowerCase().split(/[:(]/)[0].trim()) ? 1 : 0;
      if (fa !== fb) return fb - fa;
      return (b.rating_votes ?? 0) - (a.rating_votes ?? 0);
    })
    .slice(0, MAX_IMPORT);

  let created = 0;
  for (const rec of ordered) {
    const key = `mu-${rec.series_id}`;
    if (have.has(key)) continue;
    const row = toRow({ ...rec, status: null, authors: null });
    if (!row.cover) continue;
    try {
      await db.work.create({ data: row });
      created++;
    } catch {
      // corrida/rerun — nunca quebra o lote
    }
  }
  console.log(`[webnovels] IMPORT OK: ${created} novas webnovels (candidatos ${candidates.size}, reqs ${reqs})`);
  return created;
}

async function topup() {
  const have = await existingMuIds();
  let created = 0;
  // 1) títulos novos: 8 termos aleatórios × até 2 páginas, create-only
  const terms = [...TERMS].sort(() => Math.random() - 0.5).slice(0, 8);
  for (const term of terms) {
    for (let page = 1; page <= 2; page++) {
      let list: MuSearchRecord[] = [];
      try {
        list = await muSearch(term, page);
      } catch {
        break;
      }
      for (const rec of list) {
        const key = `mu-${rec.series_id}`;
        if (have.has(key) || !rec.image?.url?.original || !(rec.title ?? "").trim()) continue;
        try {
          await db.work.create({ data: toRow({ ...rec, status: null, authors: null }) });
          have.add(key);
          created++;
        } catch {}
      }
      if (list.length < 25) break;
      await sleep(GAP_SEARCH);
    }
    await sleep(GAP_SEARCH);
  }
  // 2) enriquecimento gradual: 150 webnovels ainda sem status ganham status/authors reais
  const enriched = await enrichBatch(150);
  console.log(`[webnovels] TOPUP OK: +${created} novas, ${enriched} enriquecidas`);
}

async function enrichBatch(n: number): Promise<number> {
  const targets = await db.work.findMany({
    where: { type: "webnovel", status: null, id: { startsWith: "mu-" } },
    select: { id: true },
    orderBy: [{ popularity: "desc" }, { id: "asc" }],
    take: n,
  });
  let done = 0;
  for (const t of targets) {
    const muId = t.id.replace(/^mu-/, "");
    try {
      const detail = await muDetail(muId);
      if (detail) {
        const row = toRow(detail);
        await db.work.update({
          where: { id: t.id },
          data: {
            status: row.status,
            chapters: row.chapters,
            authors: row.authors,
            synopsis: row.synopsis || undefined,
            avgScore: row.avgScore,
            popularity: row.popularity,
            genres: row.genres,
            cover: row.cover || undefined,
            lastUpdate: row.lastUpdate,
          },
        });
        done++;
      }
    } catch {
      // falha pontual — o topup de amanhã cobre
    }
    await sleep(GAP_ENRICH);
  }
  return done;
}

async function main() {
  const arg = process.argv[2] ?? "";
  if (arg === "--status") {
    const total = await db.work.count({ where: { type: "webnovel" } });
    const withStatus = await db.work.count({ where: { type: "webnovel", status: { not: null } } });
    const withCover = await db.work.count({ where: { type: "webnovel", NOT: { cover: "" } } });
    console.log(`[webnovels] total=${total} comStatus=${withStatus} comCapa=${withCover}`);
  } else if (arg === "--topup") {
    await topup();
  } else if (arg === "--enrich") {
    const n = Number(process.argv[3] ?? 100);
    console.log(`[webnovels] enriquecendo ${n}…`);
    const done = await enrichBatch(n);
    console.log(`[webnovels] ENRICH OK: ${done}`);
  } else if (arg === "--famous") {
    await importFull(true);
  } else {
    await importFull();
  }
  // invalida o pool para a UI ver as obras novas na hora
  try {
    const { invalidateWorksCache } = await import("../src/lib/works");
    invalidateWorksCache();
    console.log("[webnovels] pool invalidado — catálogo visível imediatamente");
  } catch {}
}

main()
  .catch((e) => {
    console.error("[webnovels] ERRO FATAL:", e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
