// Conta obras em ambos os bancos (real e cópia do standalone) para diagnosticar divergência
import Database from "better-sqlite3";

const DBS = [
  { label: "REAL     /home/z/my-project/db/custom.db", file: "/home/z/my-project/db/custom.db" },
  { label: "STANDALONE .next/standalone/db/custom.db", file: "/home/z/my-project/.next/standalone/db/custom.db" },
];

for (const { label, file } of DBS) {
  try {
    const db = new Database(file, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'").all().map((r) => r.name);
    let workCount = "?";
    if (tables.includes("Work")) {
      workCount = db.prepare("SELECT COUNT(*) c FROM Work").get().c;
    }
    const total = tables.reduce((acc, t) => {
      try { return acc + db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c; } catch { return acc; }
    }, 0);
    console.log(`${label}`);
    console.log(`  tabelas: ${tables.length} · Work: ${workCount} · linhas totais: ${total}`);
    db.close();
  } catch (e) {
    console.log(`${label}\n  ERRO: ${e.message}`);
  }
}
