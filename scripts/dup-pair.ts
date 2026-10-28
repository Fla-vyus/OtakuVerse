import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const a: any = await db.$queryRawUnsafe(`SELECT id, title, cover IS NOT NULL AND cover!='' hasCover, synopsis IS NOT NULL AND length(synopsis)>50 hasSyn, popularity, favourites, avgScore, genres IS NOT NULL AND length(genres)>2 hasGenres, tags IS NOT NULL AND length(tags)>5 hasTags, banner IS NOT NULL AND banner!='' hasBanner, nextEpisodeAt IS NOT NULL hasNext, lastUpdate IS NOT NULL hasLast, length(authors) authorsLen, length(extLinks) extLen FROM Work WHERE id IN ('16498','anilist-16498')`);
  console.log(JSON.stringify(a, null, 1));
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
