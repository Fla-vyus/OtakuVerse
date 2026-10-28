/**
 * Correção de integridade das tags/classificação (pedido: "confira se nas tags estão
 * aparecendo as obras certas, como em ecchi/sensorial").
 *
 * PROBLEMA ENCONTRADO: o gênero "Ecchi" (dado oficial da AniList) marcava 2.650 obras,
 * mas só 889 estavam classification=suggestive — 1.659 obras ecchi de verdade
 * (Kuzu no Honkai, We Never Learn, Yamada-kun to 7-nin no Majo, Yancha Gal no Anjou-san…)
 * ficavam "safe" e NÃO apareciam no filtro/seção Ecchi/Sensorial, enquanto obras com
 * cenas de banho pontuais (ex.: Black Clover, via tag Nudity) apareciam. Classificação
 * invertida do ponto de vista do usuário.
 *
 * REGRA NOVA (alinhada com a AniList): gênero "Ecchi" ⇒ suggestive (spicy=1).
 * Obras adult continuam adult (nunca rebaixamos adulto).
 *
 * BÔNUS: corrige URLs do Feed Social gravadas com escape HTML (&amp;) — causava
 * /api/img 403 (imagens quebradas no feed).
 *
 * Uso: npx tsx scripts/fix-ecchi-genre.ts
 */
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

async function main() {
  const before: any[] = await db.$queryRawUnsafe("SELECT classification, COUNT(*) n FROM Work WHERE type != 'drama' GROUP BY classification");
  console.log("antes :", before.map((r) => `${r.classification}=${Number(r.n)}`).join(" · "));

  // gênero "Ecchi" (JSON array de gêneros) + ainda safe → suggestive/spicy 1
  const moved = await db.work.updateMany({
    where: { classification: "safe", genres: { contains: '"Ecchi"' } },
    data: { classification: "suggestive", spicy: 1 },
  });
  console.log(`gênero Ecchi safe→suggestive: ${moved.count} obras`);

  // defesa dupla (mesma regra do fix-spicy): nada de adult rebaixado, spicy sempre alinhado
  const a = await db.work.updateMany({ where: { classification: "adult", NOT: { spicy: 2 } }, data: { spicy: 2 } });
  const s = await db.work.updateMany({ where: { classification: "suggestive", NOT: { spicy: 1 } }, data: { spicy: 1 } });
  const safe0 = await db.work.updateMany({ where: { classification: "safe", NOT: { spicy: 0 } }, data: { spicy: 0 } });
  console.log(`spicy sync: adult→2=${a.count} suggestive→1=${s.count} safe→0=${safe0.count}`);

  const after: any[] = await db.$queryRawUnsafe("SELECT classification, COUNT(*) n FROM Work WHERE type != 'drama' GROUP BY classification");
  console.log("depois:", after.map((r) => `${r.classification}=${Number(r.n)}`).join(" · "));

  // checagem de coerência: toda obra suggestive deve ter Ecchi (gênero) OU tag Nudity/Sexual Content/Ecchi relevante
  const incoerentes: any[] = await db.$queryRawUnsafe(`
    SELECT COUNT(*) n FROM Work
    WHERE classification = 'suggestive'
      AND genres NOT LIKE '%"Ecchi"%'
      AND tags NOT LIKE '%"Nudity"%'
      AND tags NOT LIKE '%"Sexual Content"%'
      AND tags NOT LIKE '%"Ecchi"%'
      AND tags NOT LIKE '%"Succubus"%'
  `);
  console.log(`suggestive sem marcador ecchi conhecido (vias raras, ok se <100): ${Number(incoerentes[0].n)}`);

  // Feed Social: URLs gravadas com escape XML (&amp;) → /api/img 403
  const img = await db.$executeRawUnsafe(`UPDATE FeedPost SET image = replace(image, '&amp;', '&') WHERE image LIKE '%&amp;%'`);
  const url = await db.$executeRawUnsafe(`UPDATE FeedPost SET url = replace(url, '&amp;', '&') WHERE url LIKE '%&amp;%'`);
  console.log(`feed: ${img} imagens e ${url} URLs com escape HTML corrigidos`);

  // estimativa do índice de tags (o que o buildCache vai criar em memória)
  const rows: any[] = await db.$queryRawUnsafe(`SELECT tags FROM Work WHERE tags IS NOT NULL`);
  const count = new Map<string, number>();
  let entries = 0;
  for (const r of rows) {
    try {
      for (const t of JSON.parse(r.tags)) {
        if ((t.rank ?? 0) >= 40) count.set(t.name, (count.get(t.name) ?? 0) + 1);
      }
    } catch {}
  }
  for (const n of count.values()) if (n >= 40) entries += n;
  console.log(`índice de tags: ${count.size} nomes com rank>=40 · ${[...count.values()].filter((n) => n >= 40).length} nomes com >=40 obras · ~${(entries / 1000).toFixed(0)}k entradas em memória`);

  await db.$disconnect();
}
main().catch((e) => { console.error(e.message || e); process.exit(1); });
