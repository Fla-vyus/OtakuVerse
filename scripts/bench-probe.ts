// Benchmark: makeRow puro + JSON + dedupe
import { performance } from "node:perf_hooks";

const t0 = performance.now();
const { makeRow } = await import("./generate-catalog");
const t1 = performance.now();
console.log(`import: ${(t1 - t0).toFixed(0)}ms`);

const seen = new Set<string>();
const rows: any[] = [];
const t2 = performance.now();
for (let i = 1; i <= 5000; i++) {
  const row = makeRow(i, "manga", 0);
  if (!seen.has(row.title)) {
    seen.add(row.title);
    rows.push(row);
  }
}
const t3 = performance.now();
console.log(`5000 makeRow: ${(t3 - t2).toFixed(0)}ms (${((t3 - t2) / 5000).toFixed(2)}ms/row)`);
console.log("exemplo:", JSON.stringify({
  title: rows[0].title, en: rows[0].titleEn, native: rows[0].titleNative,
  syn: rows[0].synonyms, mag: rows[0].magazine, cover: rows[0].cover,
}));
console.log("exemplo2:", JSON.stringify({
  title: rows[100].title, en: rows[100].titleEn, native: rows[100].titleNative, syn: rows[100].synonyms,
}));
console.log("exemplo3:", JSON.stringify({
  title: rows[2000].title, en: rows[2000].titleEn, native: rows[2000].titleNative, syn: rows[2000].synonyms,
}));
process.exit(0);
