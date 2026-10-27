/**
 * Auditoria de imagens — via SQL direto (à prova de validação Prisma).
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const total = await db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) c FROM Work`);
  const semCapa = await db.$queryRawUnsafe<any[]>(`SELECT COUNT(*) c FROM Work WHERE cover='' OR cover IS NULL`);
  const porTipo = await db.$queryRawUnsafe<any[]>(`
    SELECT type, COUNT(*) c, SUM(CASE WHEN cover='' OR cover IS NULL THEN 1 ELSE 0 END) sc
    FROM Work GROUP BY type`);
  const porDominio = await db.$queryRawUnsafe<any[]>(`
    SELECT CASE
      WHEN cover LIKE '%anilist%' THEN 'anilist'
      WHEN cover LIKE '%mangadex%' THEN 'mangadex'
      WHEN cover LIKE '%kitsu%' THEN 'kitsu'
      WHEN cover LIKE '%tvmaze%' THEN 'tvmaze'
      ELSE 'outro' END dom, COUNT(*) c
    FROM Work GROUP BY dom`);
  const comAlts = await db.$queryRawUnsafe<any[]>(`
    SELECT COUNT(*) c FROM Work WHERE coverAlts IS NOT NULL AND coverAlts NOT IN ('', '[]')`);

  console.log("=== AUDITORIA DO BANCO ===");
  console.log(`Total: ${total[0].c} | Sem capa: ${semCapa[0].c} | Com coverAlts: ${comAlts[0].c}`);
  console.table(porTipo);
  console.table(porDominio);

  const semCapaPop = await db.$queryRawUnsafe<any[]>(`
    SELECT id, title, type, popularity FROM Work
    WHERE cover='' OR cover IS NULL ORDER BY popularity DESC LIMIT 20`);
  console.log("\n=== SEM CAPA (mais populares) ===");
  console.table(semCapaPop);

  const amostra = await db.$queryRawUnsafe<any[]>(`
    SELECT id, title, cover FROM Work WHERE cover NOT IN ('','') AND cover IS NOT NULL
    ORDER BY popularity DESC LIMIT 8`);
  console.log("\n=== AMOSTRA DE CAPAS (populares) ===");
  for (const w of amostra) console.log(`${w.id} | ${String(w.title).slice(0, 40)} | ${String(w.cover).slice(0, 90)}`);

  console.log("\n=== VERIFICAÇÃO DE FAMOSOS ===");
  const famosos = ["One Piece", "Berserk", "Naruto", "Death Note", "Solo Leveling", "Jujutsu Kaisen", "Chainsaw Man", "Oshi no Ko"];
  for (const f of famosos) {
    const rows = await db.$queryRawUnsafe<any[]>(
      `SELECT id, title, cover, coverAlts FROM Work WHERE title LIKE ? LIMIT 1`, `%${f}%`);
    if (!rows.length) console.log(`✗ NÃO ENCONTRADO: ${f}`);
    else console.log(`${rows[0].cover ? "✓ capa ok " : "✗ SEM CAPA "} | ${rows[0].title} | ${String(rows[0].cover || "").slice(0, 85)}`);
  }
}

main().finally(() => db.$disconnect());
