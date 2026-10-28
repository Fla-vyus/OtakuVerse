// Auditoria da seção "Ecchi/Sensorial em Alta" da home
// Replica EXATAMENTE o filtro atual: classification=suggestive, com capa, ordenado por favoritos
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const rows = await db.$queryRawUnsafe<any[]>(
    `SELECT id, title, genres, tags, favourites, popularity, spicy, classification, ptTags
     FROM work WHERE classification='suggestive' AND cover IS NOT NULL AND cover != ''
     ORDER BY favourites DESC LIMIT 24`
  );
  console.log("=== TOP 24 SUGGESTIVE POR FAVORITOS (o que a home serve HOJE) ===");
  for (const r of rows) {
    const genres = JSON.parse(r.genres || "[]");
    const tags = JSON.parse(r.tags || "[]").map((t: any) => `${t.name}:${t.rank}`);
    console.log(`- [${r.favourites ?? 0} fav] ${r.title} | gêneros: ${genres.join(", ")}`);
    console.log(`    tags: ${tags.slice(0, 8).join(", ")}`);
  }
  console.log(`\nTotal suggestive com capa: ${(await db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) n FROM work WHERE classification='suggestive' AND cover IS NOT NULL AND cover != ''`))[0].n}`);
  const byGenre = await db.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*) n FROM work WHERE classification='suggestive' AND cover IS NOT NULL AND cover != '' AND genres LIKE '%Ecchi%'`
  );
  console.log(`Desses, com gênero Ecchi (ecchi de verdade): ${byGenre[0].n}`);
}

main().finally(() => db.$disconnect());
