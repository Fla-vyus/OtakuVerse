// Probe: insere 2000 linhas reais do gerador e cronometra cada fase
import { PrismaClient } from "@prisma/client";
import { performance } from "node:perf_hooks";

const { makeRow } = await import("./generate-catalog.ts");
const db = new PrismaClient();

const t0 = performance.now();
const rows: any[] = [];
const seen = new Set<string>();
for (let i = 1; i <= 2000; i++) {
  const row = makeRow(i, "manga", 0);
  if (!seen.has(row.title)) {
    seen.add(row.title);
    rows.push(row);
  }
}
const t1 = performance.now();
console.log(`gen 2000: ${(t1 - t0).toFixed(0)}ms`);

const t2 = performance.now();
await db.work.createMany({ data: rows });
const t3 = performance.now();
console.log(`createMany 2000 reais: ${(t3 - t2).toFixed(0)}ms`);

const t4 = performance.now();
const del = await db.work.deleteMany({ where: { id: { startsWith: "g" }, title: { not: "KEEP" } } });
console.log(`cleanup: skip (${del.count} deletados)`);
const t5 = performance.now();
console.log(`deleteMany: ${(t5 - t4).toFixed(0)}ms`);
await db.$disconnect();
