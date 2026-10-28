// Auditoria das categorias/seções da home: cada fileira está com as obras CERTAS?
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const fmt = (n: any) => Number(n ?? 0);

async function main() {
  const all = await db.$queryRawUnsafe<any[]>(`SELECT id, title, type, genres, tags, classification, status, startDate, avgScore, popularity, favourites FROM work`);
  const parse = (r: any) => ({
    ...r,
    genres: JSON.parse(r.genres || "[]"),
    tags: JSON.parse(r.tags || "[]"),
    startDate: r.startDate ?? "",
  });
  const works = all.map(parse).filter((w) => w.classification !== "adult" && w.type !== "drama");
  console.log(`Pool público: ${works.length} obras`);

  const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const monthKey = new Date().toISOString().slice(0, 7);
  const sample = (arr: any[], n = 3) => arr.slice(0, n).map((w) => w.title.slice(0, 30)).join(" · ");
  const BOOK = ["manga", "manhwa", "manhua"];

  // 1 Lançamentos: últimos 120 dias, com capa, pop>=300
  const launches = works.filter((w) => w.startDate >= daysAgo(120) && w.startDate <= today && (w.popularity ?? 0) >= 300).sort((a, b) => b.popularity - a.popularity);
  console.log(`\n1) Lançamentos (${launches.length}):`, sample(launches));
  const badLaunch = launches.slice(0, 24).filter((w) => !(w.startDate >= daysAgo(120)));
  console.log(`   violação de data no top24: ${badLaunch.length}`);

  // 2 Mangás novos: livros, começaram há ≤120 dias
  const newMangas = works.filter((w) => BOOK.includes(w.type) && w.startDate >= daysAgo(120) && w.startDate <= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
  console.log(`2) Mangás Novos (${newMangas.length}):`, sample(newMangas));
  const wrongType = newMangas.slice(0, 24).filter((w) => !BOOK.includes(w.type));
  console.log(`   não-livro no top24: ${wrongType.length}`);

  // 3 Bombando: RELEASING livros com ≤5 caps ou estreia ≤540 dias + pop>=3000
  const hits = works.filter((w) => w.status === "RELEASING" && BOOK.includes(w.type) && ((w.chapters != null && w.chapters <= 5) || (w.startDate >= daysAgo(540) && w.popularity >= 3000))).sort((a, b) => b.popularity - a.popularity);
  console.log(`3) Bombando (${hits.length}):`, sample(hits));

  // 4 Bestsellers: mais favoritados
  const best = [...works].sort((a, b) => fmt(b.favourites) - fmt(a.favourites));
  console.log(`4) Mais buscados:`, sample(best));

  // 5 Obras-Primas: nota >= 80
  const master = works.filter((w) => fmt(w.avgScore) >= 80).sort((a, b) => fmt(b.avgScore) - fmt(a.avgScore));
  console.log(`5) Obras-Primas (${master.length}):`, sample(master));
  const lowScore = master.slice(0, 24).filter((w) => fmt(w.avgScore) < 80);
  console.log(`   nota <80 no top24: ${lowScore.length}`);

  // 6 Manhwas em alta: type=manhwa por popularidade
  const manhwa = works.filter((w) => w.type === "manhwa").sort((a, b) => b.popularity - a.popularity);
  console.log(`6) Manhwas (${manhwa.length}):`, sample(manhwa));
  const notManhwa = manhwa.slice(0, 24).filter((w) => w.type !== "manhwa");
  console.log(`   não-manhwa no top24: ${notManhwa.length}`);

  // 7 Ecchi real: gênero Ecchi OU Nudity>=75
  const ecchi = works.filter((w) => w.genres.includes("Ecchi") || w.tags.some((t: any) => t.name === "Nudity" && t.rank >= 75)).sort((a, b) => fmt(b.favourites) - fmt(a.favourites));
  console.log(`7) Ecchi real (${ecchi.length}):`, sample(ecchi));
  const fakeEcchi = ecchi.slice(0, 24).filter((w) => !w.genres.includes("Ecchi") && !w.tags.some((t: any) => t.name === "Nudity" && t.rank >= 75));
  console.log(`   não-ecchi no top24: ${fakeEcchi.length}`);

  // 8 Animes do momento
  const anime = works.filter((w) => w.type === "anime").sort((a, b) => fmt(b.favourites) - fmt(a.favourites));
  console.log(`8) Animes (${anime.length}):`, sample(anime));
  const notAnime = anime.slice(0, 24).filter((w) => w.type !== "anime");
  console.log(`   não-anime no top24: ${notAnime.length}`);

  // 9 Estreias do mês
  const month = works.filter((w) => w.startDate.startsWith(monthKey)).sort((a, b) => b.popularity - a.popularity);
  console.log(`9) Estreias do mês (${month.length}):`, sample(month));

  // Chips: 3 spot-checks
  const tagOf = (w: any, name: string) => w.tags.some((t: any) => t.name === name && t.rank >= 40);
  const isekai = works.filter((w) => tagOf(w, "Isekai"));
  const shounen = works.filter((w) => tagOf(w, "Shounen"));
  const vilain = works.filter((w) => tagOf(w, "Villainess"));
  console.log(`\nCHIPS → Isekai: ${isekai.length} (${sample(isekai)})`);
  console.log(`CHIPS → Shounen: ${shounen.length} (${sample(shounen)})`);
  console.log(`CHIPS → Vilã: ${vilain.length} (${sample(vilain)})`);
}

main().finally(() => db.$disconnect());
