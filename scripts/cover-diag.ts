// Diagnóstico: por que 18.477 obras estão sem capa?
// Verifica se são linhas parciais (backfill bugado) ou dados reais faltando.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function j<T>(s: string | null, fb: T): T { try { return s ? JSON.parse(s) : fb; } catch { return fb; } }

async function main() {
  const noCover = await db.work.findMany({
    where: { cover: "" },
    select: { id: true, title: true, type: true, synopsis: true, tags: true, genres: true, popularity: true, avgScore: true, lastUpdate: true },
    orderBy: { popularity: "desc" },
    take: 8,
  });
  console.log("amostra sem capa (top popularidade):");
  for (const w of noCover) {
    console.log(`  #${w.id} [${w.type}] ${w.title} | pop=${w.popularity} | score=${w.avgScore} | sin=${(w.synopsis ?? "").slice(0, 40)} | tags=${j<{name:string}[]>(w.tags, []).length} | lastUpdate=${w.lastUpdate}`);
  }

  // distribuição por faixa de id (numéricos = AniList; prefixos = outras fontes)
  const ids = await db.work.findMany({ where: { cover: "" }, select: { id: true } });
  let numeric = 0, prefixed = 0;
  for (const r of ids) (/^\d+$/.test(r.id) ? numeric++ : prefixed++);
  console.log("\nids numéricos (AniList):", numeric, "| com prefixo (outras fontes):", prefixed);

  // popularidade das sem-capa
  const popular = await db.work.count({ where: { cover: "", popularity: { gte: 1000 } } });
  const veryPopular = await db.work.count({ where: { cover: "", popularity: { gte: 10000 } } });
  console.log("sem capa com pop>=1000:", popular, "| pop>=10000:", veryPopular);
}

main().finally(() => db.$disconnect());
