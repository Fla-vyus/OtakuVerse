// Calibra o limiar de ecchi real: rank das tags Ecchi/Nudity nos falsos positivos vs legítimos
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const targets = ["Chainsaw Man", "Shin Seiki Evangelion", "Berserk", "Black Clover", "Cowboy Bebop", "Made in Abyss", "Dandadan", "Oyasumi Punpun", "Mushoku Tensei", "Kono Subarashii", "No Game No Life", "Kill la Kill", "Kuzu no Honkai", "High School DxD", "To Love-Ru", "Yamada-kun", "We Never Learn", "Redo of Healer", "World's End Harem", "Fire Force"];

async function main() {
  for (const t of targets) {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT title, genres, tags FROM work WHERE title LIKE ${JSON.stringify("%" + t + "%")} AND classification='suggestive' LIMIT 2`
    );
    for (const r of rows) {
      const tags = JSON.parse(r.tags || "[]");
      const interesting = tags.filter((x: any) => ["Ecchi", "Nudity", "Succubus", "Sexual Content", "Virginity"].includes(x.name)).map((x: any) => `${x.name}:${x.rank}`);
      const genres = JSON.parse(r.genres || "[]");
      console.log(`${r.title.slice(0, 55).padEnd(56)} | EcchiGenre=${genres.includes("Ecchi")} | ${interesting.join(" ") || "(nenhuma tag spicy no top-15)"}`);
    }
  }
  // quantos suggestive ficariam fora com gênero Ecchi somente
  const only = await db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) n FROM work WHERE classification='suggestive' AND genres LIKE '%Ecchi%'`);
  console.log(`\nTotal suggestive com gênero Ecchi: ${only[0].n}`);
}

main().finally(() => db.$disconnect());
