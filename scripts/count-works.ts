// Conta obras no banco
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.$queryRawUnsafe<any[]>("SELECT type, COUNT(*) as n FROM Work GROUP BY type");
console.log(rows);
const total = await db.work.count();
console.log("TOTAL:", total);
await db.$disconnect();
