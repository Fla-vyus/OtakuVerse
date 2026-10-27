import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const rows = await db.work.findMany({ where: { banner: { not: null } }, take: 5, orderBy: { popularity: "desc" }, select: { id: true, title: true } });
console.log(JSON.stringify(rows));
await db.$disconnect();
