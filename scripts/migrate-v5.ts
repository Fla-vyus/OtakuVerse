// Migração v5: popula ptTags (JSON string[]) para todo o acervo com derivação
// (+18 / Hentai / Ecchi / Webtoon / origem). Usa tabela temporária + UPDATE FROM.
import { PrismaClient, Prisma } from '@prisma/client';
import { buildPtTags } from '../src/lib/tagmap';

const db = new PrismaClient();

type Row = { id: string; genres: string | null; tags: string | null; isAdult: boolean; source: string | null; type: string };

async function* iterateWorks(batchSize = 3000) {
  let cursor: string | null = null;
  while (true) {
    const rows: Row[] = await db.$queryRaw`
      SELECT id, genres, tags, isAdult, source, type
      FROM Work
      ${cursor ? Prisma.sql`WHERE id > ${cursor}` : Prisma.empty}
      ORDER BY id
      LIMIT ${batchSize}
    `;
    if (rows.length === 0) return;
    cursor = rows[rows.length - 1].id;
    yield rows;
  }
}

async function main() {
  const t0 = Date.now();
  await db.$executeRawUnsafe(`
    CREATE TEMP TABLE IF NOT EXISTS stage_pt (
      id TEXT PRIMARY KEY,
      pt TEXT NOT NULL
    )
  `);

  let processed = 0;
  let batchIdx = 0;

  for await (const rows of iterateWorks()) {
    // monta lista de [id, ptJson]
    const pairs: [string, string][] = rows.map((r) => {
      let genres: string[] = [];
      let tags: { name: string; rank: number }[] = [];
      try { genres = r.genres ? JSON.parse(r.genres) : []; } catch {}
      try { tags = r.tags ? JSON.parse(r.tags) : []; } catch {}
      const pt = buildPtTags({ genres, tags, isAdult: r.isAdult, source: r.source, type: r.type });
      return [r.id, JSON.stringify(pt)];
    });

    // INSERT em chunk de 800
    for (let i = 0; i < pairs.length; i += 800) {
      const chunk = pairs.slice(i, i + 800);
      const values = Prisma.join(
        chunk.map(([id, pt]) => Prisma.sql`(${id}, ${pt})`),
        ', '
      );
      await db.$executeRaw`INSERT OR REPLACE INTO stage_pt (id, pt) VALUES ${values}`;
    }

    processed += rows.length;
    batchIdx++;
    if (batchIdx % 10 === 0) {
      console.log(`processadas ${processed} obras... (${Math.round((Date.now() - t0) / 1000)}s)`);
    }
  }

  console.log('aplicando UPDATE FROM...');
  const t1 = Date.now();
  await db.$executeRawUnsafe(`UPDATE Work SET ptTags = (SELECT pt FROM stage_pt WHERE stage_pt.id = Work.id)`);
  console.log(`UPDATE levou ${Math.round((Date.now() - t1) / 1000)}s`);

  // derivar isAdult também a partir da tag +18 (Nudity forte etc.)
  const t2 = Date.now();
  const adultCount = await db.$executeRawUnsafe(`UPDATE Work SET isAdult = 1 WHERE ptTags LIKE '%"Hentai"%'`);
  console.log(`isAdult marcado p/ ${adultCount} obras (Hentai) — ${Math.round((Date.now() - t2) / 1000)}s`);

  const stats = await db.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*) as c FROM Work WHERE ptTags LIKE '%"Hentai"%'
  `;
  const plus18 = await db.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*) as c FROM Work WHERE ptTags LIKE '%"\\+18"%' ESCAPE '\\'
  `;
  const ecchi = await db.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*) as c FROM Work WHERE ptTags LIKE '%"Ecchi"%'
  `;
  console.log(`Hentai: ${stats[0].c} | +18: ${plus18[0].c} | Ecchi: ${ecchi[0].c} | total: ${processed}`);
  console.log(`MIGRAÇÃO COMPLETA em ${Math.round((Date.now() - t0) / 1000)}s`);
}

main().finally(() => db.$disconnect());
