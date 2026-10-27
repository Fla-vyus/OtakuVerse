// Pré-cache das capas do catálogo adulto (+18) — materializa em disco
import { PrismaClient } from "@prisma/client";
import { cacheRemoteImage } from "../src/lib/imgcache";

const prisma = new PrismaClient();
const log = (...a: any[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const works = await prisma.work.findMany({
    where: { spicy: { gte: 1 } },
    orderBy: [{ popularity: "desc" }],
    select: { cover: true, coverAlts: true },
  });
  const urls = new Set<string>();
  for (const w of works) {
    if (w.cover) urls.add(w.cover);
    try {
      for (const a of JSON.parse(w.coverAlts ?? "[]")) if (typeof a === "string") urls.add(a);
    } catch {}
  }
  log(`adultas: ${works.length} obras — fila ${urls.size} imagens`);

  const all = [...urls];
  let ok = 0, fail = 0, done = 0;
  const CONC = 8;
  let cursor = 0;
  async function worker() {
    while (cursor < all.length) {
      const u = all[cursor++];
      const r = await cacheRemoteImage(u);
      if (r) ok++; else fail++;
      done++;
      if (done % 150 === 0) log(`progresso ${done}/${all.length} (ok ${ok} · fail ${fail})`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  log(`CONCLUÍDO: ${ok} em disco · ${fail} falhas de ${all.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
