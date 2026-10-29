// Smoke test v3.8 — Prisma + adapter-libsql apontando para o TURSO.
// Simula exatamente o caminho que a função serverless da Vercel usará.
// Uso: node scripts/smoke-turso.mjs
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? "libsql://otakuverse-fla-vyus.turso.io";
process.env.TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN ?? "";

const t0 = Date.now();
const { PrismaClient } = await import("@prisma/client");
const { PrismaLibSQL } = await import("@prisma/adapter-libsql");

const adapter = new PrismaLibSQL({
  url: process.env.DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
const prisma = new PrismaClient({ adapter, log: ["error"] });

const total = await prisma.work.count();
console.log(`✓ count(Work) = ${total}`);

const sample = await prisma.work.findMany({
  take: 5,
  orderBy: { avgScore: "desc" },
  select: { id: true, title: true, type: true, avgScore: true, isAdult: true },
});
console.log("✓ top 5 por avgScore:");
for (const w of sample)
  console.log(`   [${w.id}] ${w.title} — ${w.type} · score ${w.avgScore}`);

const busca = await prisma.work.findFirst({
  where: { title: { contains: "Chainsaw" } },
  select: { id: true, title: true },
});
console.log(`✓ busca "chainsaw" → [${busca?.id}] ${busca?.title}`);

// escrita: EventLog é append-only e seguro para teste
await prisma.eventLog.create({
  data: { kind: "smoke-test", payload: "smoke-turso OK" },
});
const logs = await prisma.eventLog.count();
console.log(`✓ escrita OK — EventLog agora tem ${logs} linhas`);

await prisma.$disconnect();
console.log(`\n✓ SMOKE TURSO OK em ${((Date.now() - t0) / 1000).toFixed(1)}s — leitura, busca e escrita via Prisma adapter funcionando.`);
