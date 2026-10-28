// Testa variantes de mapeamento para a chip "Reencarnação feminina".
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function j(s: string | null): { name: string; rank: number }[] {
  try { return s ? JSON.parse(s) : []; } catch { return []; }
}
const has = (w: { tags: string | null }, ns: string[]) =>
  j(w.tags).some((t) => ns.includes(t.name) && t.rank >= 40);

async function main() {
  const works = await db.work.findMany({
    where: { NOT: { type: "drama" } },
    select: { id: true, title: true, tags: true, popularity: true },
  });

  const variants: { name: string; test: (w: any) => boolean }[] = [
    { name: "Só Villainess", test: (w) => has(w, ["Villainess"]) },
    { name: "Reincarnation AND Female Protagonist", test: (w) => has(w, ["Reincarnation"]) && has(w, ["Female Protagonist"]) },
    { name: "(Reincarnation OR Villainess) AND Female Protagonist", test: (w) => (has(w, ["Reincarnation"]) || has(w, ["Villainess"])) && has(w, ["Female Protagonist"]) },
  ];

  for (const v of variants) {
    const hits = works.filter(v.test);
    const top = [...hits].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 8);
    console.log(`\n[${v.name}] → ${hits.length} obras`);
    console.log("  top:", top.map((t) => t.title).join(" · "));
  }
}

main().finally(() => db.$disconnect());
