// Conta obras nos dois bancos para diagnosticar divergência (roda com npx tsx)
import { PrismaClient } from "@prisma/client";

async function main() {
  // banco real (URL do .env)
  const p1 = new PrismaClient();
  const c1 = await p1.work.count();
  const tables1 = await p1.$queryRawUnsafe<{ name: string }[]>("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'");
  console.log(`REAL db/custom.db → Work: ${c1} · tabelas: ${tables1.length}`);
  await p1.$disconnect();

  // cópia do standalone (URL absoluta temporária)
  process.env.DATABASE_URL = "file:/home/z/my-project/.next/standalone/db/custom.db";
  const p2 = new PrismaClient();
  try {
    const c2 = await p2.work.count();
    console.log(`STANDALONE .next/standalone/db/custom.db → Work: ${c2}`);
  } catch (e: any) {
    console.log("STANDALONE ERRO:", String(e?.message).slice(0, 160));
  }
  await p2.$disconnect();
}

main().catch((e) => { console.error("FALHA:", e.message); process.exit(1); });
