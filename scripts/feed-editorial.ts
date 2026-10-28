/**
 * Matérias editoriais da Redação OtakuVerse — fatos REAIS pesquisados (out/2026),
 * escritos em PT-BR e linkados a obras reais do catálogo (capa incluída).
 * Upsert por id fixo → rodar de novo nunca duplica nem apaga.
 * Fontes usadas: naruto-official.com (anúncio oficial), Crunchyroll News, VIZ, ANN, @todayanimenews.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface Draft {
  id: string;
  title: string;
  body: string;
  tags: string[];
  publishedAt: Date;
  workCandidates: { type?: string; titles: string[] }; // 1º match vence
}

const DRAFTS: Draft[] = [
  {
    id: "ed-naruto-new-2026-10",
    title: "Naruto volta: Kishimoto anuncia novo mangá escrito e desenhado por ele mesmo",
    body: `A larger-than-life surpresa caiu no dia 10 de outubro, aniversário do ninja mais famoso do Japão: durante o palco "NARUTO: What's Next?" na New York Comic Con, a franquia confirmou um novo mangá de Naruto escrito E desenhado por Masashi Kishimoto, o criador original. O teaser mostrou storyboards de tirar o fôlego — a face de pedra do Sétimo Hokage ainda em construção no monumento da Vila da Folha, Naruto com o chapéu de Hokage, Kakashi sorrindo, Sakura com um bebê no colo e, no choque final, Naruto e Sasuke frente a frente.\n\nQuem acompanhou o encerramento de Boruto sabe o peso disso: é a primeira vez desde 2014 que a caneta do Kishimoto volta integralmente ao universo shinobi em formato de mangá. A editorial não divulgou data de estreia nem título definitivo — o próximo capítulo dessa história será contado no palco "Naruto" Jump Super Stage do Jump Festa 2027, nos dias 19 e 20 de dezembro, em Chiba.\n\nFique de olho: assim que o título e a data saírem, o catálogo do OtakuVerse recebe a obra automaticamente. Enquanto isso, vale reler os clássicos — o monumento da Folha nunca esteve tão perto de ganhar uma nova face.`,
    tags: ["naruto", "kishimoto", "jump festa", "anúncio"],
    publishedAt: new Date("2026-10-10T21:00:00Z"),
    workCandidates: { type: "manga", titles: ["Naruto"] },
  },
  {
    id: "ed-akane-banashi-s2-2026-10",
    title: "Akane-banashi confirma 2ª temporada e solta novo teaser com elenco de volta",
    body: `O rakugo mais quente da Jump ganhou a confirmação que os fãs pediam em voz alta: Akane-banashi terá segunda temporada, e a produção celebrou o anúncio liberando um novo teaser trailer em 23 de outubro — com o elenco principal retornando. A série que transformou contadores de histórias tradicionais em batalhas elétricas de palco segue sendo uma das apostas de prestígio da Shueisha.\n\nO teaser mantém a pegada visual que conquistou o público: expressões teatrais exageradas de propósito, cortes secos no ritmo do rakugo e a determinação da Akane em cada painel animado. A volta do elenco original é o sinal mais forte de continuidade de qualidade — a direção de voz foi um dos pontos mais elogiados da primeira temporada.\n\nSe você caiu no mundo do mangá recentemente e ainda não deu uma chance ao título, esta é a janela perfeita: são poucos volumes, o ritmo é de palco e de campeão, e a segunda temporada já está oficialmente a caminho. Hachibi, confrade de ouro.`,
    tags: ["akane-banashi", "anime", "teaser", "shueisha"],
    publishedAt: new Date("2026-10-23T15:00:00Z"),
    workCandidates: { type: "manga", titles: ["Akane-banashi"] },
  },
  {
    id: "ed-jump-festa-2027-lineup",
    title: "Jump Festa 2027 revela grade do palco — e Kagurabachi já tem dia marcado",
    body: `A maior festa da Shueisha já tem data e primeiros nomes: Jump Festa 2027 acontece em 19 e 20 de dezembro no Makuhari Messe, e a grade dos palcos começou a ser divulgada. O dia 19 reserva espaço para Kagurabachi — o fenômeno que virou o mangá mais falado da nova geração da Weekly Shōnen Jump — junto de outras franquias peso-pesado da casa.\n\nJump Festa é historicamente o palco das bombas: é onde animes ganham trailers finais, elencos completos e datas de estreia. Com Naruto confirmado no palco principal do evento, a edição 2027 promete ser das mais movimentadas dos últimos anos — e a comunidade já especula o que mais a Shueisha guarda na manga.\n\nPara quem quer chegar preparado: vale colocar os títulos confirmados em dia antes de dezembro. O nosso catálogo acompanha cada capítulo da Weekly em tempo real — basta abrir a obra e seguir a leitura.`,
    tags: ["jump festa", "kagurabachi", "evento", "shueisha"],
    publishedAt: new Date("2026-10-24T18:00:00Z"),
    workCandidates: { type: "manga", titles: ["Kagurabachi"] },
  },
  {
    id: "ed-trinity-seven-novel-2026",
    title: "Trinity Seven ganha novel escrita pelo autor original — e anime novo em janeiro",
    body: `Pausa para a boa velha escola de magia: Trinity Seven confirmou adaptação em novel escrita pelo próprio autor do mangá, além de uma nova série de anime com estreia marcada para 8 de janeiro de 2027. A franquia que mistura magia de arcanos, comédia espinhosa e um elenco feminino carismático volta com tudo ao calendário.\n\nO detalhe que faz diferença: ter o autor original escrevendo a novel significa coerência canônica — nada de spin-off solto. É o mesmo cuidado que editoras japonesas têm aplicado nas franquias longevas, e o resultado costuma ser material que dialoga direto com o mangá sem medo de contradição.\n\nCom o anime estreando em janeiro, outubro e novembro são o momento ideal para (re)começar o mangá. Sete trinity, sete chances de você escolher sua favorita — o catálogo tem tudo linkado.`,
    tags: ["trinity seven", "novel", "anime 2027", "anúncio"],
    publishedAt: new Date("2026-10-26T15:00:00Z"),
    workCandidates: { type: "anime", titles: ["TRINITY SEVEN", "Trinity Seven"] },
  },
  {
    id: "ed-viz-outubro-2026",
    title: "Outubro quente nas prateleiras: Ichi the Witch, Firefly Wedding e 11 estreias na VIZ",
    body: `O mês fecha com prateleira cheia na VIZ: além dos lançamentos contínuos da Weekly Shōnen Jump, outubro trouxe Ichi the Witch e Firefly Wedding Vol. 8 no papel, com mais de 11 séries estreando no catálogo da editora ao longo do mês. Para completar, Naruto Shippuden recebeu a Parte 12 em Blu-ray/DVD no dia 20.\n\nIchi the Witch merece atenção dobrada: é uma das apostas de fantasia mais bem recebidas da Jump recente, com arte exuberante e um sistema de magia que já rendeu comparações favoráveis com grandes clássicos do gênero. Firefly Wedding, por sua vez, é o drama romântico josei que dominou conversas de fãs do gênero — volume a volume.\n\nSe o seu bolso está no verde, esta é a hora de garimpar: estreias de catálogo costumam sair com preço de lançamento e viram coleção cobiçada depois. E se o seu vício é só digital, fique tranquilo — nosso explorar tem tudo linkado por revista e editora.`,
    tags: ["viz", "lançamentos", "ichi the witch", "firefly wedding"],
    publishedAt: new Date("2026-10-27T14:00:00Z"),
    workCandidates: { type: "manga", titles: ["Ichi the Witch"] },
  },
  {
    id: "ed-fall-2026-manga-guide",
    title: "Guia de outono 2026: Wandering Son volta e Judge ganha nova edição",
    body: `O guia de lançamentos de outono 2026 reservou dois nomes históricos: o retorno de Wandering Son (Hourou Musuko), de Takako Shimura, e uma nova edição de Judge, de Yoshiki Tonogai. São duas obras que marcaram época por razões completamente diferentes — e que merecem lugar na estante de qualquer fã que queira entender o espectro completo do mangá.\n\nWandering Son segue como um dos retratos mais sensíveis já publicados sobre identidade de gênero e adolescência, assinado pela mestre de Fruits Basket de outro gênero — Shimura constrói dramas cotidianos com delicadeza cirúrgica. Judge, do lado sombrio, é o death game clássico dos anos 2010: seis pessoas, um prédio lacrado e escolhas morais que apodrecem rápido.\n\nOutono no Japão é temporada de prêmios e de reedições — o momento que as editoras usam para apresentar clássicos a novas gerações. Garimpe bem: às vezes o melhor "lançamento novo" é uma obra-prima relida.`,
    tags: ["outono 2026", "wandering son", "judge", "clássicos"],
    publishedAt: new Date("2026-10-27T20:00:00Z"),
    workCandidates: { titles: ["Wandering Son", "Hourou Musuko"] },
  },
];

async function findWork(c: Draft["workCandidates"]) {
  for (const t of c.titles) {
    const where: any = { isAdult: false, OR: [{ titleEn: t }, { title: t }] };
    if (c.type) where.type = c.type;
    const w = await db.work.findFirst({ where, select: { id: true, cover: true, coverColor: true }, orderBy: { popularity: "desc" } });
    if (w) return w;
  }
  return null;
}

async function main() {
  console.log("=== feed-editorial ===");
  let n = 0;
  for (const d of DRAFTS) {
    const w = await findWork(d.workCandidates);
    await db.feedPost.upsert({
      where: { id: d.id },
      create: {
        id: d.id, kind: "editorial", source: "Redação OtakuVerse", handle: "Aoi-chan ✍️",
        title: d.title, body: d.body, image: w?.cover ?? null, workId: w?.id ?? null,
        tags: JSON.stringify(d.tags), publishedAt: d.publishedAt,
      },
      update: {
        title: d.title, body: d.body, image: w?.cover ?? null, workId: w?.id ?? null, tags: JSON.stringify(d.tags),
      },
    });
    console.log(`  ✓ ${d.id} → obra ${w?.id ?? "—"} (${d.title.slice(0, 48)}…)`);
    n++;
  }
  const total = await db.feedPost.count();
  console.log(`✓ ${n} matérias editoriais garantidas — feed total: ${total} posts`);
  await db.$disconnect();
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
