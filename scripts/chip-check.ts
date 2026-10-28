// Valida as chips famosas com a gramática EXATA do filterWorks ("," = OU · "+" = E).
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function j(s: string | null): { name: string; rank: number }[] {
  try { return s ? JSON.parse(s) : []; } catch { return []; }
}

const CHIPS: { label: string; expr: string }[] = [
  { label: "Isekai", expr: "Isekai" },
  { label: "Shounen", expr: "Shounen" },
  { label: "Seinen", expr: "Seinen" },
  { label: "Escola", expr: "School" },
  { label: "Magia", expr: "Magic" },
  { label: "Reencarnação feminina", expr: "Reincarnation+Female Protagonist,Villainess" },
];

const MIN_RANK = 40;

function matches(w: { tags: string | null }, groups: string[][]): boolean {
  const tags = j(w.tags).filter((t) => t.rank >= MIN_RANK);
  return groups.some((g) => g.every((name) => tags.some((t) => t.name === name)));
}

async function main() {
  const works = await db.work.findMany({
    where: { NOT: { type: "drama" } },
    select: { id: true, title: true, type: true, classification: true, tags: true, popularity: true },
  });
  for (const chip of CHIPS) {
    const groups = chip.expr.split(",").map((g) => g.split("+").map((t) => t.trim()).filter(Boolean)).filter((g) => g.length);
    const hits = works.filter((w) => matches(w, groups));
    const top = [...hits].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0)).slice(0, 8);
    console.log(`\n[${chip.label}] expr="${chip.expr}" → ${hits.length} obras`);
    console.log("  top:", top.map((t) => `${t.title} [${t.type}]`).join(" · "));
  }
}

main().finally(() => db.$disconnect());
