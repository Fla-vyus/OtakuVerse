/**
 * Correção de integridade: sincroniza a coluna `spicy` (camada sensorial 0/1/2)
 * com a coluna `classification` (safe/suggestive/adult). Ficaram dessincronizadas
 * no seed (535 adult com spicy=0, 882 suggestive com spicy=0) — rotas que filtram
 * por spicy (ex.: /api/home, /api/recommendations com explicit) mostravam a seção
 * "Picante" vazia e podiam incluir adulto em camadas não-explícitas.
 * Uso: npx tsx scripts/fix-spicy.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const a = await db.work.updateMany({ where: { classification: "adult", NOT: { spicy: 2 } }, data: { spicy: 2 } });
  const s = await db.work.updateMany({ where: { classification: "suggestive", NOT: { spicy: 1 } }, data: { spicy: 1 } });
  // defesa dupla: qualquer isAdult=true sem classification adult também é 2
  const d = await db.work.updateMany({ where: { isAdult: true, NOT: { spicy: 2 } }, data: { classification: "adult", spicy: 2 } });
  console.log(`spicy sync: adult→2 = ${a.count}, suggestive→1 = ${s.count}, isAdult-defesa = ${d.count}`);
  const check: any[] = await db.$queryRawUnsafe("SELECT classification, spicy, COUNT(*) n FROM Work GROUP BY classification, spicy");
  for (const r of check) console.log(`  ${r.classification}/spicy=${r.spicy}: ${Number(r.n)}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
