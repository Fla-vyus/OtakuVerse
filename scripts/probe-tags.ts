import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const rows = await db.work.findMany({ select: { tags: true, genres: true } });
  const tagCount = new Map<string, number>();
  const genreCount = new Map<string, number>();
  for (const raw of rows) {
    try {
      for (const t of JSON.parse(raw.tags ?? "[]")) tagCount.set(t.name, (tagCount.get(t.name) ?? 0) + 1);
      for (const g of JSON.parse(raw.genres ?? "[]")) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    } catch {}
  }
  const tags = [...tagCount.entries()].sort((a, b) => b[1] - a[1]);
  console.log('TOTAL distinct tags:', tags.length);
  console.log('TOP 160 tags:');
  for (const [n, c] of tags.slice(0, 160)) console.log(`${n}\t${c}`);
  console.log('GENRES:', [...genreCount.entries()].sort((a,b)=>b[1]-a[1]).map(([n,c])=>`${n}(${c})`).join(' '));
}
main().finally(() => db.$disconnect());
