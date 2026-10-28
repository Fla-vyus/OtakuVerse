import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  // duplicatas exatas: mesmo title + type (colisão real de obra)
  const dups = await db.$queryRawUnsafe<{ title: string; type: string; n: number; ids: string }[]>(`
    SELECT title, type, COUNT(*) as n, GROUP_CONCAT(id) as ids
    FROM Work GROUP BY title, type HAVING COUNT(*) > 1 ORDER BY n DESC LIMIT 15`);
  let total = 0;
  for (const d of dups) { console.log(`${d.n}x [${d.type}] ${d.title} → ids ${String(d.ids).slice(0,60)}`); }
  const [{ n: dupGroups }]: any = await db.$queryRawUnsafe(`SELECT COUNT(*) as n FROM (SELECT 1 FROM Work GROUP BY title, type HAVING COUNT(*) > 1)`);
  const [{ n: dupRows }]: any = await db.$queryRawUnsafe(`SELECT SUM(n)-COUNT(*) as n FROM (SELECT COUNT(*) as n FROM Work GROUP BY title, type HAVING COUNT(*) > 1)`);
  console.log(`grupos duplicados: ${dupGroups} | linhas extras: ${dupRows}`);
  const [{ n: totalAll }]: any = await db.$queryRawUnsafe(`SELECT COUNT(*) as n FROM Work`);
  console.log(`total: ${totalAll}`);
  await db.$disconnect();
}
main();
