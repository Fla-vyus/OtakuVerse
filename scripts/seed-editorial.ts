/**
 * Aplica metadados editoriais (revista/derivação) às obras que ainda não têm.
 * Executar: npx tsx scripts/seed-editorial.ts
 */
import { PrismaClient } from "@prisma/client";
import { matchMagazine, deriveEditorial } from "../src/lib/magazines";

const db = new PrismaClient();

async function main() {
  const rows = await db.work.findMany({
    where: { magazine: null, classification: { not: "adult" } },
    select: { id: true, title: true, titleEn: true, country: true, format: true, tags: true },
  });
  console.log(`★ Editorial: ${rows.length} obras sem metadados`);
  let n = 0;
  for (const w of rows) {
    let tags: { name: string; rank: number }[] = [];
    try {
      tags = JSON.parse(w.tags ?? "[]");
    } catch {}
    const mag = matchMagazine(w.title, w.titleEn, w.country, tags, []) ?? deriveEditorial(w.country, tags, w.format);
    if (mag) {
      await db.work.update({
        where: { id: w.id },
        data: {
          magazine: JSON.stringify({
            name: mag.name, publisher: mag.publisher, demographic: mag.demographic,
            schedule: mag.schedule, accepts: mag.accepts, famous: mag.famous, source: "derivado",
          }),
        },
      });
      n++;
    }
  }
  console.log(`★ Concluído: ${n} obras enriquecidas com metadados de revista`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
