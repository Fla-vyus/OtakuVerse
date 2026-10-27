// Pré-cache de imagens REAIS em disco — OtakuVerse
// Baixa do CDN oficial uma única vez e materializa em db/imgcache/ para que o
// site sirva as imagens localmente (proteção contra rate-limit/hotlink/queda
// de CDN — o problema de imagens que "somem" reportado pelo usuário).
// Só baixa de fontes reais (whitelist em src/lib/imgcache.ts).

import { PrismaClient } from "@prisma/client";
import { cacheRemoteImage } from "../src/lib/imgcache";

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const MAX_POP = Number(args[0] ?? 1500); // capas das obras mais populares
const MAX_EXTRA = Number(args[1] ?? 600); // recentes/seguidas/favoritas
const WITH_ALTS = args[2] !== "--no-alts";

const log = (...a: any[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const urls = new Set<string>();

  // 1) Top populares — capas + banners (home, rankings, hero, detalhe)
  const top = await prisma.work.findMany({
    orderBy: [{ popularity: "desc" }],
    take: MAX_POP,
    select: { cover: true, banner: true, coverAlts: true },
  });
  for (const w of top) {
    if (w.cover) urls.add(w.cover);
    if (w.banner) urls.add(w.banner);
    if (WITH_ALTS) for (const a of safeAlts(w.coverAlts)) urls.add(a);
  }
  log(`top populares: ${top.length} obras — fila parcial ${urls.size}`);

  // 2) Recentes / seguidas / favoritas (lançamentos, hot new, rankings)
  const recentes = await prisma.work.findMany({
    orderBy: [{ lastUpdate: "desc" }],
    take: MAX_EXTRA,
    select: { cover: true, banner: true },
  });
  const seguidas = await prisma.work.findMany({
    orderBy: [{ follows: "desc" }],
    take: Math.floor(MAX_EXTRA / 2),
    select: { cover: true },
  });
  const favoritas = await prisma.work.findMany({
    orderBy: [{ favourites: "desc" }],
    take: Math.floor(MAX_EXTRA / 2),
    select: { cover: true },
  });
  for (const w of [...recentes, ...seguidas, ...favoritas]) {
    if (w.cover) urls.add(w.cover);
    if ((w as any).banner) urls.add((w as any).banner);
  }
  log(`com recentes/seguidas/favoritas: fila ${urls.size}`);

  // 3) Fotos das notícias (RSS oficial do MAL, materializadas no NewsCache)
  const news = await prisma.newsCache.findMany({ select: { items: true } });
  let newsImgs = 0;
  for (const n of news) {
    try {
      const items = JSON.parse(n.items) as { image?: string | null }[];
      for (const it of items) if (it.image) { urls.add(it.image); newsImgs++; }
    } catch {}
  }
  log(`fotos de notícias: ${newsImgs} — fila final ${urls.size}`);

  // 4) Download com progresso
  const all = [...urls];
  let ok = 0, fail = 0, done = 0;
  const CONC = 8;
  let cursor = 0;
  const failures: string[] = [];

  async function worker() {
    while (cursor < all.length) {
      const idx = cursor++;
      const u = all[idx];
      const res = await cacheRemoteImage(u);
      if (res) ok++;
      else { fail++; if (failures.length < 30) failures.push(u); }
      done++;
      if (done % 100 === 0) log(`progresso ${done}/${all.length} (ok ${ok} · fail ${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));

  log(`CONCLUÍDO: ${ok} imagens em disco · ${fail} falhas de ${all.length}`);
  if (failures.length) {
    console.log("Amostra de falhas:");
    for (const f of failures) console.log("  -", f);
  }
}

function safeAlts(json?: string | null): string[] {
  try {
    const arr = JSON.parse(json ?? "[]") as string[];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.startsWith("https://")) : [];
  } catch {
    return [];
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
