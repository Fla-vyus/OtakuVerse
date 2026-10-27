// Diagnóstico rápido para planejar v5
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  const now = Math.floor(Date.now() / 1000);

  const counts = await db.work.groupBy({ by: ['type'], _count: true });
  console.log('== por tipo ==');
  for (const c of counts) console.log(c.type, c._count);

  const adult = await db.work.count({ where: { isAdult: true } });
  console.log('isAdult:', adult);

  const ecchiGenre = await db.work.count({ where: { genres: { contains: '"Ecchi"' } } });
  console.log('genre Ecchi:', ecchiGenre);

  // novos hits: manga/manhwa com <= 5 caps e sucesso
  const earlyHits = await db.work.count({
    where: {
      type: { in: ['manga', 'manhwa'] },
      chapters: { not: null, lte: 5 },
      status: 'RELEASING',
      popularity: { gte: 500 },
    },
  });
  console.log('early hits (<=5 caps, releasing, pop>=500):', earlyHits);

  const earlyHitsStrong = await db.work.count({
    where: {
      type: { in: ['manga', 'manhwa'] },
      chapters: { not: null, lte: 5 },
      status: 'RELEASING',
      favourites: { gte: 50 },
    },
  });
  console.log('early hits fortes (fav>=50):', earlyHitsStrong);

  // lançamentos recentes (startDate 2025+)
  const recent = await db.work.count({ where: { startDate: { gte: '2025-01' } } });
  const veryRecent = await db.work.count({ where: { startDate: { gte: '2025-07' } } });
  console.log('startDate 2025+:', recent, '| 2025-07+:', veryRecent);

  // streaming: extLinks com plataformas conhecidas
  const crunchy = await db.work.count({ where: { extLinks: { contains: 'Crunchyroll' } } });
  const netflix = await db.work.count({ where: { extLinks: { contains: 'Netflix' } } });
  const prime = await db.work.count({ where: { extLinks: { contains: 'Amazon Prime' } } });
  const disney = await db.work.count({ where: { extLinks: { contains: 'Hulu' } } });
  console.log('extLinks streaming — crunchy:', crunchy, 'netflix:', netflix, 'prime:', prime, 'hulu:', disney);

  // animes em lançamento com nextEpisodeAt
  const airing = await db.work.count({ where: { type: 'anime', status: 'RELEASING', nextEpisodeAt: { not: null } } });
  const airingNoDate = await db.work.count({ where: { type: 'anime', status: 'RELEASING' } });
  const notYet = await db.work.count({ where: { type: 'anime', status: 'NOT_YET_RELEASED' } });
  console.log('anime airing com data:', airing, '| airing total:', airingNoDate, '| não lançados:', notYet);

  // animes com próxima data futura (temporadas futuras)
  const futureStarts = await db.work.findMany({
    where: { type: 'anime', startDate: { gte: '2025-10' } },
    orderBy: { startDate: 'asc' },
    take: 5,
    select: { title: true, startDate: true, episodes: true },
  });
  console.log('anime estreias futuras amostra:', futureStarts);

  // amostra de um early hit
  const sample = await db.work.findMany({
    where: { type: 'manga', chapters: { not: null, lte: 5 }, status: 'RELEASING', favourites: { gte: 100 } },
    orderBy: { popularity: 'desc' },
    take: 5,
    select: { title: true, chapters: true, startDate: true, popularity: true, favourites: true },
  });
  console.log('early hits amostra:', sample);

  // tags com rank: quantas obras têm tag Sex/Nudity/Ecchi
  const nudity = await db.work.count({ where: { tags: { contains: '"Nudity"' } } });
  console.log('tag Nudity:', nudity);

  // volumes definidos (para "primeiros volumes")
  const firstVols = await db.work.count({
    where: { type: { in: ['manga', 'manhwa'] }, volumes: { not: null, lte: 2 }, startDate: { gte: '2024-01' } },
  });
  console.log('primeiros volumes (vols<=2, 2024+):', firstVols);

  // lastUpdate recente (atividade p/ "ao vivo")
  const active = await db.work.count({ where: { lastUpdate: { gte: now - 7 * 86400 } } });
  const activeDay = await db.work.count({ where: { lastUpdate: { gte: now - 1 * 86400 } } });
  console.log('lastUpdate 7d:', active, '| 24h:', activeDay);
}

main().finally(() => db.$disconnect());
