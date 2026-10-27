import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  const agg = await db.work.aggregate({ _max: { lastUpdate: true, startDate: true, nextEpisodeAt: true, createdAt: true } });
  console.log('MAX lastUpdate:', agg._max.lastUpdate, '=', agg._max.lastUpdate ? new Date((agg._max.lastUpdate as number)*1000).toISOString() : null);
  console.log('MAX startDate:', agg._max.startDate);
  console.log('MAX nextEpisodeAt:', agg._max.nextEpisodeAt);
  console.log('MAX createdAt:', agg._max.createdAt);
  const now = Math.floor(Date.now()/1000);
  console.log('sandbox now:', now, new Date(now*1000).toISOString());
  const airing = await db.work.findMany({ where: { type: 'anime', nextEpisodeAt: { not: null } }, orderBy: { nextEpisodeAt: 'desc' }, take: 3, select: { title: true, nextEpisodeAt: true, nextEpisodeNum: true } });
  console.log('nextEpisodeAt mais recentes:', airing);
}
main().finally(() => db.$disconnect());
