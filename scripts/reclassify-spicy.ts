// Reclassificação one-shot da camada sensorial (spicy) com a regra conservadora v3.8.
// SÓ ABAIXA (1 → 0) — nunca sobe para adulto e nunca toca em isAdult. Aditivo e reversível:
// o próximo sync de fontes reclassifica o que mudar de verdade.
// Uso: node scripts/reclassify-spicy.ts
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function classifySpicy(genres: string[], tags: { name: string; rank: number }[]): number {
  if (genres.includes("Ecchi")) return 1;
  const ranks = new Map(tags.map((t) => [t.name, t.rank]));
  const ecchi = ranks.get("Ecchi") ?? 0;
  const nudity = ranks.get("Nudity") ?? 0;
  const sexual = ranks.get("Sexual Content") ?? 0;
  const sensual = Math.max(ranks.get("Succubus") ?? 0, sexual);
  if (ecchi >= 75 || nudity >= 70 || sensual >= 70) return 1;
  return 0;
}

async function main() {
  const works = await db.work.findMany({
    where: { isAdult: false, classification: { not: "adult" } },
    select: { id: true, title: true, genres: true, tags: true, spicy: true },
  });
  console.log(`Avaliando ${works.length} obras não-adultas...`);
  let demoted = 0, kept = 0, badJson = 0;
  const samples: string[] = [];
  for (const w of works) {
    let genres: string[] = [], tags: { name: string; rank: number }[] = [];
    try { genres = JSON.parse(w.genres ?? "[]"); } catch { badJson++; continue; }
    try { tags = JSON.parse(w.tags ?? "[]"); } catch { badJson++; continue; }
    const next = classifySpicy(genres, tags);
    if (next < w.spicy) {
      demoted++;
      await db.work.update({ where: { id: w.id }, data: { spicy: next, classification: next === 0 ? "safe" : w.classification } });
      if (samples.length < 12) samples.push(`${w.title}: ${w.spicy}→${next}`);
    } else kept++;
  }
  console.log(`Rebaixadas (ecchi→safe): ${demoted} · mantidas suggestive: ${kept} · JSON inválido: ${badJson}`);
  console.log("Amostras:\n" + samples.map((s) => "  - " + s).join("\n"));
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
