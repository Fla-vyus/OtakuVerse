// Auditoria de tags: as obras certas aparecem em Ecchi/Sensorial e nas tags famosas?
// Verifica consistência entre tag/genre "Ecchi" e classification, e lista as tags mais comuns.
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function j<T>(s: string | null, fb: T): T { try { return s ? JSON.parse(s) : fb; } catch { return fb; } }

async function main() {
  const works = await db.work.findMany({
    where: { NOT: { type: "drama" } },
    select: { id: true, title: true, type: true, classification: true, spicy: true, isAdult: true, genres: true, tags: true, popularity: true, favourites: true },
  });
  console.log("total (sem dramas):", works.length);

  // distribuição de classification
  const byClass: Record<string, number> = {};
  for (const w of works) byClass[w.classification] = (byClass[w.classification] ?? 0) + 1;
  console.log("classificação:", byClass);

  // 1) Tag "Ecchi" (AniList tag) por classificação
  const ecchiTag = works.filter((w) => j<{name:string;rank:number}[]>(w.tags, []).some((t) => t.name === "Ecchi"));
  const ecchiTagByClass: Record<string, number> = {};
  for (const w of ecchiTag) ecchiTagByClass[w.classification] = (ecchiTagByClass[w.classification] ?? 0) + 1;
  console.log("\n[TAG Ecchi] total:", ecchiTag.length, "por classificação:", ecchiTagByClass);
  // obras com tag Ecchi mas rank baixo (<30) → classificadas safe. São "erradas" na tag?
  const lowRank = ecchiTag.filter((w) => {
    const t = j<{name:string;rank:number}[]>(w.tags, []).find((x) => x.name === "Ecchi");
    return t && t.rank < 30 && w.classification === "safe";
  });
  console.log("[TAG Ecchi] safe com rank<30 (borderline):", lowRank.length);
  console.log("  exemplos:", lowRank.slice(0, 8).map((w) => `${w.title} (rank ${j<{name:string;rank:number}[]>(w.tags,[]).find((x)=>x.name==="Ecchi")?.rank})`));

  // 2) Genre "Ecchi" (AniList genre) por classificação
  const ecchiGenre = works.filter((w) => j<string[]>(w.genres, []).includes("Ecchi"));
  const ecchiGenreByClass: Record<string, number> = {};
  for (const w of ecchiGenre) ecchiGenreByClass[w.classification] = (ecchiGenreByClass[w.classification] ?? 0) + 1;
  console.log("\n[GENRE Ecchi] total:", ecchiGenre.length, "por classificação:", ecchiGenreByClass);
  const safeEcchiGenre = ecchiGenre.filter((w) => w.classification === "safe");
  console.log("  exemplos safe c/ genre Ecchi:", safeEcchiGenre.slice(0, 10).map((w) => w.title));

  // 3) suggestive SEM tag Ecchi (é esperado: nudity/succubus também contam)
  const sugg = works.filter((w) => w.classification === "suggestive");
  const suggNoEcchi = sugg.filter((w) => !j<{name:string;rank:number}[]>(w.tags, []).some((t) => t.name === "Ecchi"));
  console.log("\n[suggestive] total:", sugg.length, "| sem tag Ecchi (via Nudity etc):", suggNoEcchi.length);
  console.log("  exemplos:", suggNoEcchi.slice(0, 6).map((w) => w.title));

  // 4) Top 30 tags por presença (rank >= 40) — candidatos a chips famosos
  const tagCount = new Map<string, number>();
  const tagPop = new Map<string, number>();
  for (const w of works) {
    for (const t of j<{name:string;rank:number}[]>(w.tags, [])) {
      if (t.rank >= 40) {
        tagCount.set(t.name, (tagCount.get(t.name) ?? 0) + 1);
        tagPop.set(t.name, (tagPop.get(t.name) ?? 0) + (w.favourites ?? 0));
      }
    }
  }
  const top = [...tagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 45);
  console.log("\n[TOP TAGS rank>=40]");
  for (const [name, count] of top) console.log(`  ${name}: ${count} obras · ${Math.round((tagPop.get(name) ?? 0) / count)} fav médios`);

  // 5) Gêneros existentes
  const gCount = new Map<string, number>();
  for (const w of works) for (const g of j<string[]>(w.genres, [])) gCount.set(g, (gCount.get(g) ?? 0) + 1);
  console.log("\n[GÊNEROS]", [...gCount.entries()].sort((a, b) => b[1] - a[1]).map(([g, c]) => `${g}:${c}`).join(" · "));

  // 6) sanity: adult vazando fora? suggestive com spicy errado?
  const badSpicy = works.filter((w) => (w.classification === "suggestive" && w.spicy !== 1) || (w.classification === "safe" && w.spicy !== 0) || (w.classification === "adult" && w.spicy !== 2));
  console.log("\nspicy desalinhado:", badSpicy.length);
}

main().finally(() => db.$disconnect());
