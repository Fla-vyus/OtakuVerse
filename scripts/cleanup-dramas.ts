// Limpeza: mantém apenas doramas REAIS (Scripted) da TVMaze com idioma do país esperado.
// Remove entradas tipo Animation/anime americano que escaparam na busca.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const COUNTRY_LANG: Record<string, string> = {
  KR: "Korean", JP: "Japanese", CN: "Mandarin", TH: "Thai",
};

async function main() {
  const dramas = await prisma.work.findMany({
    where: { type: "drama" },
    select: { id: true, title: true, country: true, source: true },
  });
  let removed = 0, kept = 0;
  for (const d of dramas) {
    const tid = d.id.slice(3);
    try {
      const res = await fetch(`https://api.tvmaze.com/shows/${tid}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        await prisma.work.delete({ where: { id: d.id } }).catch(() => {});
        removed++;
        continue;
      }
      const s: any = await res.json();
      // manter: Scripted com idioma asiático da região (TVMaze usa "Chinese" para CN)
      const asianLangs = ["Korean", "Japanese", "Mandarin", "Chinese", "Cantonese", "Thai", "Korean/Mandarin"];
      const okType = s.type === "Scripted";
      const okLang = asianLangs.includes(s.language);
      if (!okType || !okLang) {
        console.log("removendo:", d.title, "| tipo:", s.type, "| idioma:", s.language);
        await prisma.work.delete({ where: { id: d.id } }).catch(() => {});
        removed++;
      } else {
        kept++;
      }
    } catch {
      kept++;
    }
    await sleep(480);
  }
  console.log(`limpeza: ${kept} doramas mantidos, ${removed} removidos`);
  await prisma.$disconnect();
}
main();
