import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  const rows: any[] = await db.$queryRawUnsafe(`SELECT id, cover IS NOT NULL AND cover != '' as hasCover FROM Work`);
  const byNum = new Map<string, any[]>();
  for (const r of rows) {
    const num = String(r.id).replace(/^anilist-/, "");
    if (!byNum.has(num)) byNum.set(num, []);
    byNum.get(num)!.push(r);
  }
  let dupGroups = 0, dupExtras = 0, prefixedOnly = 0, noCoverTwins = 0, bareNoCoverPrefHas = 0;
  for (const [num, grp] of byNum) {
    const hasBare = grp.some((r) => !String(r.id).startsWith("anilist-"));
    if (grp.length > 1) {
      dupGroups++; dupExtras += grp.length - 1;
      for (const r of grp) if (!r.hasCover) noCoverTwins++;
      if (hasBare) {
        const bare = grp.find((r) => !String(r.id).startsWith("anilist-"))!;
        const pref = grp.find((r) => String(r.id).startsWith("anilist-"));
        if (!bare.hasCover && pref?.hasCover) bareNoCoverPrefHas++;
      }
    } else if (String(grp[0].id).startsWith("anilist-")) prefixedOnly++;
  }
  console.log(`obras únicas (por id AniList): ${byNum.size}`);
  console.log(`grupos duplicados: ${dupGroups} | linhas extras: ${dupExtras}`);
  console.log(`obras SÓ com id 'anilist-' (renomear p/ numérico): ${prefixedOnly}`);
  console.log(`linhas sem capa entre duplicatas: ${noCoverTwins} | casos onde o numérico não tem capa mas o gêmeo tem: ${bareNoCoverPrefHas}`);
  const lib: any = await db.$queryRawUnsafe(`SELECT COUNT(*) n FROM LibraryItem`);
  const shelf: any = await db.$queryRawUnsafe(`SELECT COUNT(*) n FROM ShelfEntry`);
  const libPref: any = await db.$queryRawUnsafe(`SELECT COUNT(*) n FROM LibraryItem WHERE workId LIKE 'anilist-%'`);
  const shelfPref: any = await db.$queryRawUnsafe(`SELECT COUNT(*) n FROM ShelfEntry WHERE workId LIKE 'anilist-%'`);
  console.log(`refs: library=${lib[0].n} (prefix=${libPref[0].n}) | shelf=${shelf[0].n} (prefix=${shelfPref[0].n})`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
