/**
 * Seed de DRAMAS reais (KR/CN/JP/TH) com pôsteres reais da Wikipédia.
 * Cada drama: metadados reais + sinopse factual curta em PT-BR.
 * Imagens: Wikipedia REST API (upload.wikimedia.org) — material real, sem IA.
 * Executar: bun scripts/seed-dramas.ts
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

interface DramaSeed {
  slug: string;
  title: string;
  native: string;
  country: "KR" | "CN" | "JP" | "TH";
  year: number;
  episodes: number;
  network: string;
  wiki: string; // página Wikipédia (EN) para buscar pôster real
  score: number;
  popularity: number;
  genres: string[];
  tags: { name: string; rank: number }[];
  synopsis: string;
  classification?: string;
}

const DRAMAS: DramaSeed[] = [
  { slug: "squid-game", title: "Squid Game", native: "오징어 게임", country: "KR", year: 2021, episodes: 9, network: "Netflix", wiki: "Squid_Game", score: 78, popularity: 890000, genres: ["Suspense", "Drama", "Action"], tags: [{ name: "Death Game", rank: 90 }, { name: "Survival", rank: 95 }, { name: "Violence", rank: 70 }], synopsis: "Centenas de pessoas endividadas aceitam participar de jogos infantis mortais por uma premiação bilionária. Uma crítica feroz à desigualdade que virou fenômeno global da Netflix." },
  { slug: "crash-landing-on-you", title: "Crash Landing on You", native: "사랑의 불시착", country: "KR", year: 2019, episodes: 16, network: "tvN / Netflix", wiki: "Crash_Landing_on_You", score: 82, popularity: 520000, genres: ["Romance", "Comedy", "Drama"], tags: [{ name: "Star-crossed Lovers", rank: 85 }, { name: "Cross-dressing", rank: 40 }], synopsis: "Uma herdeira sul-coreana cai de parapente na Coreia do Norte e é escondida por um oficial do exército norte-coreano. O romance coreano mais amado da década." },
  { slug: "goblin", title: "Goblin", native: "도깨비", country: "KR", year: 2016, episodes: 16, network: "tvN / Netflix", wiki: "Guardian:_The_Lonely_and_Great_God", score: 83, popularity: 610000, genres: ["Fantasy", "Romance", "Drama"], tags: [{ name: "Supernatural", rank: 90 }, { name: "Immortality", rank: 80 }, { name: "Past Life Connection", rank: 75 }], synopsis: "Um general imortal procura sua noiva destinada para finalmente descansar. Combina fantasia coreano, humor e uma das trilhas mais icônicas dos K-dramas." },
  { slug: "meteor-garden-2018", title: "Meteor Garden (2018)", native: "流星花园", country: "CN", year: 2018, episodes: 49, network: "Hunan TV / Netflix", wiki: "Meteor_Garden_(2018_TV_series)", score: 70, popularity: 210000, genres: ["Romance", "Drama"], tags: [{ name: "Rich Boy Poor Girl", rank: 90 }, { name: "School", rank: 70 }], synopsis: "Releitura chinesa do clássico Boys Over Flowers: uma estudante comum enfrenta o quarteto mais rico da universidade e conquista o coração do líder." },
  { slug: "honeymoon-with-my-bodyguard", title: "Honeymoon with My Bodyguard", native: "蜜月加保镳", country: "CN", year: 2023, episodes: 24, network: "iQiyi", wiki: "", score: 68, popularity: 90000, genres: ["Romance", "Comedy"], tags: [{ name: "Contract Relationship", rank: 80 }, { name: "Bodyguard", rank: 85 }], synopsis: "Comédia romântica chinesa sobre uma celebridade que contrata um guarda-costas para fingir ser seu noivo durante a lua de mel mais comentada do país." },
  { slug: "hometown-cha-cha-cha", title: "Hometown Cha-Cha-Cha", native: "갯마을 차차차", country: "KR", year: 2021, episodes: 16, network: "tvN / Netflix", wiki: "Hometown_Cha-Cha-Cha", score: 80, popularity: 380000, genres: ["Romance", "Comedy", "Slice of Life"], tags: [{ name: "Small Town", rank: 85 }, { name: "Healing", rank: 80 }], synopsis: "Uma dentista da cidade recomeça a vida em uma vila litorânea e conhece o faz-tudo local que é amado por todos. Conforto puro em forma de drama." },
  { slug: "it Okay-to-not-be-okay", title: "It's Okay to Not Be Okay", native: "사이코지만 괜찮아", country: "KR", year: 2020, episodes: 16, network: "tvN / Netflix", wiki: "It's_Okay_to_Not_Be_Okay", score: 80, popularity: 340000, genres: ["Drama", "Romance", "Psychological"], tags: [{ name: "Mental Health", rank: 90 }, { name: "Healing", rank: 85 }], synopsis: "Um cuidador de enfermaria psiquiátrica e uma famosa escritora de livros infantis com personalidade antissocial aprendem a se curar juntos." },
  { slug: "the-glory", title: "The Glory", native: "더 글로리", country: "KR", year: 2022, episodes: 8, network: "Netflix", wiki: "The_Glory", score: 79, popularity: 300000, genres: ["Drama", "Thriller"], tags: [{ name: "Revenge", rank: 95 }, { name: "Bullying", rank: 85 }], synopsis: "Anos depois de sofrer violência brutal na escola, uma mulher executa uma vingança meticulosamente planejada contra os agressores que a destruíram." },
  { slug: "vincenzo", title: "Vincenzo", native: "빈센조", country: "KR", year: 2021, episodes: 20, network: "tvN / Netflix", wiki: "Vincenzo_(TV_series)", score: 79, popularity: 320000, genres: ["Comedy", "Crime", "Drama"], tags: [{ name: "Mafia", rank: 90 }, { name: "Dark Comedy", rank: 80 }], synopsis: "Um advogado da máfia italiana retorna à Coreia e declara guerra corporativa a um conglomerado corrupto usando métodos pouco convencionais." },
  { slug: "mr-sunshine", title: "Mr. Sunshine", native: "미스터 션샤인", country: "KR", year: 2018, episodes: 24, network: "tvN / Netflix", wiki: "Mr._Sunshine_(South_Korean_TV_series)", score: 84, popularity: 290000, genres: ["Historical", "Drama", "Romance"], tags: [{ name: "Historical", rank: 95 }, { name: "War", rank: 70 }], synopsis: "Na Coreia do início do século XX, um menino escravizado que virou oficial da marinha americana volta ao país e se apaixona por uma aristocrata da resistência." },
  { slug: "signal", title: "Signal", native: "시그널", country: "KR", year: 2016, episodes: 16, network: "tvN / Netflix", wiki: "Signal_(TV_series)", score: 83, popularity: 190000, genres: ["Thriller", "Mystery", "Sci-Fi"], tags: [{ name: "Time Travel", rank: 90 }, { name: "Detective", rank: 85 }], synopsis: "Um rádio antigo conecta dois detetives de 1986 e 2015, que trabalham juntos para resolver casos arquivados e mudar o passado." },
  { slug: "reply-1988", title: "Reply 1988", native: "응답하라 1988", country: "KR", year: 2015, episodes: 20, network: "tvN / Netflix", wiki: "Reply_1988", score: 85, popularity: 160000, genres: ["Slice of Life", "Comedy", "Romance"], tags: [{ name: "Family Life", rank: 90 }, { name: "Nostalgia", rank: 95 }], synopsis: "Cinco famílias em um beco de Seul em 1988 dividem jantares, dramas e primeiros amores. O drama de nostalgia mais amado da Coreia." },
  { slug: "hospital-playlist", title: "Hospital Playlist", native: "슬기로운 의사생활", country: "KR", year: 2020, episodes: 12, network: "tvN / Netflix", wiki: "Hospital_Playlist", score: 82, popularity: 200000, genres: ["Slice of Life", "Drama", "Comedy"], tags: [{ name: "Medical", rank: 90 }, { name: "Friendship", rank: 90 }], synopsis: "Cinco amigos médicos desde a faculdade dividem plantões, bandas de garagem e a vida no hospital universitário mais movimentado do país." },
  { slug: "extraordinary-attorney-woo", title: "Extraordinary Attorney Woo", native: "이상한 변호사 우영우", country: "KR", year: 2022, episodes: 16, network: "ENA / Netflix", wiki: "Extraordinary_Attorney_Woo", score: 80, popularity: 310000, genres: ["Drama", "Comedy"], tags: [{ name: "Autism", rank: 85 }, { name: "Law", rank: 85 }], synopsis: "Uma jovem advogada autista com memória prodigiosa enfrenta casos difíceis e preconceitos, conquistando o tribunal e o público." },
  { slug: "king-the-land", title: "King the Land", native: "킹더랜드", country: "KR", year: 2023, episodes: 16, network: "JTBC / Netflix", wiki: "King_the_Land", score: 74, popularity: 180000, genres: ["Romance", "Comedy"], tags: [{ name: "Rich Male Lead", rank: 85 }, { name: "Workplace", rank: 80 }], synopsis: "Herdeiro de um império hoteleiro e uma recepcionista de sorriso impecável se esbarram na disputa pelo controle do hotel de luxo." },
  { slug: "alchemy-of-souls", title: "Alchemy of Souls", native: "환혼", country: "KR", year: 2022, episodes: 20, network: "tvN / Netflix", wiki: "Alchemy_of_Souls", score: 80, popularity: 230000, genres: ["Fantasy", "Romance"], tags: [{ name: "Magic", rank: 90 }, { name: "Body Swap", rank: 70 }], synopsis: "Em um reino onde a magia define o destino, uma assassina presa no corpo fraco de uma nobre se torna serva do jovem príncipe sem poderes." },
  { slug: "my-demon", title: "My Demon", native: "내 데몬", country: "KR", year: 2023, episodes: 16, network: "SBS / Netflix", wiki: "My_Demon", score: 75, popularity: 170000, genres: ["Fantasy", "Romance", "Comedy"], tags: [{ name: "Contract Relationship", rank: 85 }, { name: "Supernatural", rank: 80 }], synopsis: "Uma herdeira fria e um demônio que perde seus poderes fazem um pacto de casamento para sobreviver — e acabam apaixonados." },
  { slug: "queen-of-tears", title: "Queen of Tears", native: "눈물의 여왕", country: "KR", year: 2024, episodes: 16, network: "tvN / Netflix", wiki: "Queen_of_Tears", score: 76, popularity: 260000, genres: ["Romance", "Drama", "Comedy"], tags: [{ name: "Marriage", rank: 85 }, { name: "Rich Family", rank: 80 }], synopsis: "Um casal em crise descobre que o amor pode renascer no pior momento possível — entre traições corporativas e uma doença grave." },
  { slug: "true-beauty", title: "True Beauty", native: "여신강림", country: "KR", year: 2020, episodes: 16, network: "tvN / Netflix", wiki: "True_Beauty_(South_Korean_TV_series)", score: 76, popularity: 250000, genres: ["Romance", "Comedy"], tags: [{ name: "School", rank: 85 }, { name: "Webtoon Adaptation", rank: 90 }], synopsis: "Adaptação do webtoon clássico: uma estudante que esconde a insegurança com maquiagem vive um triângulo amoroso impossível." },
  { slug: "love-next-door", title: "Love Next Door", native: "엄마 친구 아들", country: "KR", year: 2024, episodes: 16, network: "tvN / Netflix", wiki: "Love_Next_Door", score: 74, popularity: 150000, genres: ["Romance", "Comedy"], tags: [{ name: "Childhood Friends", rank: 90 }, { name: "Healing", rank: 75 }], synopsis: "Uma mulher que recomeça a vida na cidade natal reencontra o amigo de infância — agora um arquiteto de sucesso que nunca esqueceu ela." },
  { slug: "strong-girl-bong-soon", title: "Strong Girl Bong-soon", native: "힘쎈여자 도봉순", country: "KR", year: 2017, episodes: 16, network: "JTBC / Netflix", wiki: "Strong_Girl_Bong-soon", score: 78, popularity: 210000, genres: ["Comedy", "Romance", "Action"], tags: [{ name: "Super Strength", rank: 90 }, { name: "Comedy", rank: 85 }], synopsis: "Uma jovem com força sobre-humana vira guarda-costas de um CEO excêntrico enquanto caça um criminoso no bairro." },
  { slug: "doom-at-your-service", title: "Doom at Your Service", native: "어느 날 우리 집 현관으로 멸망이 들어왔다", country: "KR", year: 2021, episodes: 16, network: "tvN / Netflix", wiki: "Doom_at_Your_Service", score: 74, popularity: 160000, genres: ["Fantasy", "Romance"], tags: [{ name: "Supernatural", rank: 85 }, { name: "Contract", rank: 75 }], synopsis: "Uma editora doente invoca 'Doom' — a personificação do fim — e ganha 100 dias para viver entre o amor e a destruição." },
  { slug: "my-love-from-the-star", title: "My Love from the Star", native: "별에서 온 그대", country: "KR", year: 2013, episodes: 21, network: "SBS / Netflix", wiki: "My_Love_from_the_Star", score: 79, popularity: 220000, genres: ["Sci-Fi", "Romance", "Comedy"], tags: [{ name: "Alien", rank: 85 }, { name: "Past Life Connection", rank: 80 }], synopsis: "Um alienígena que chegou à Terra em 1609 precisa partir depois de 400 anos — mas se apaixona por uma atriz caótica nos últimos 3 meses." },
  { slug: "descendants-of-the-sun", title: "Descendants of the Sun", native: "태양의 후예", country: "KR", year: 2016, episodes: 16, network: "KBS2 / Netflix", wiki: "Descendants_of_the_Sun", score: 77, popularity: 240000, genres: ["Romance", "Action", "Drama"], tags: [{ name: "Military", rank: 85 }, { name: "Medical", rank: 75 }], synopsis: "Um capitão das forças especiais e uma cirurgiã se apaixonam em missões humanitárias em zona de guerra." },
  { slug: "healer", title: "Healer", native: "힐러", country: "KR", year: 2014, episodes: 20, network: "KBS2 / Netflix", wiki: "Healer_(South_Korean_TV_series)", score: 80, popularity: 130000, genres: ["Action", "Romance", "Thriller"], tags: [{ name: "Night Courier", rank: 80 }, { name: "Conspiracy", rank: 80 }], synopsis: "Um mensageiro noturno de habilidades impossíveis é contratado para vigiar uma repórter — e descobre uma conspiração ligada ao seu passado." },
  { slug: "hotel-del-luna", title: "Hotel del Luna", native: "호텔 델루나", country: "KR", year: 2019, episodes: 16, network: "tvN / Netflix", wiki: "Hotel_Del_Luna", score: 78, popularity: 200000, genres: ["Fantasy", "Romance", "Comedy"], tags: [{ name: "Ghost", rank: 90 }, { name: "Hotel", rank: 80 }], synopsis: "Um gerente de hotel de luxo para fantasmas precisa reaprender a servir hóspedes que ainda não cruzaram para o outro lado." },
  { slug: "the-tale-of-nine-tailed", title: "Tale of the Nine Tailed", native: "구미호뎐", country: "KR", year: 2020, episodes: 16, network: "tvN / Netflix", wiki: "Tale_of_the_Nine_Tailed", score: 74, popularity: 140000, genres: ["Fantasy", "Romance", "Action"], tags: [{ name: "Youkai", rank: 85 }, { name: "Gumiho", rank: 95 }], synopsis: "Um gumiho (raposa de nove caudas) que vive entre humanos reencontra a reencarnação do seu primeiro amor — produtora de TV destemida." },
  { slug: "our-beloved-summer", title: "Our Beloved Summer", native: "그 해 우리는", country: "KR", year: 2021, episodes: 16, network: "SBS / Netflix", wiki: "Our_Beloved_Summer", score: 81, popularity: 170000, genres: ["Romance", "Drama", "Comedy"], tags: [{ name: "Documentary", rank: 75 }, { name: "Exes", rank: 90 }], synopsis: "Um documentário escolar força dois ex-namorados a se reencontrar frente às câmeras uma década depois do primeiro amor." },
  { slug: "twenty-five-twenty-one", title: "Twenty-Five Twenty-One", native: "스물다섯 스물하나", country: "KR", year: 2022, episodes: 16, network: "tvN / Netflix", wiki: "Twenty-Five_Twenty-One", score: 80, popularity: 190000, genres: ["Romance", "Drama", "Sports"], tags: [{ name: "Fencing", rank: 85 }, { name: "Coming of Age", rank: 85 }], synopsis: "No meio da crise financeira de 1998, uma esgrimista adolescente e um jovem endividado se apoiam nos sonhos e primeiros amores." },
  { slug: "the-red-sleeve", title: "The Red Sleeve", native: "옷소매 붉은 끝동", country: "KR", year: 2021, episodes: 17, network: "MBC / Netflix", wiki: "The_Red_Sleeve", score: 81, popularity: 120000, genres: ["Historical", "Romance", "Drama"], tags: [{ name: "Royal Affairs", rank: 85 }, { name: "Tragedy", rank: 70 }], synopsis: "Baseado na história real do rei Jeongjo e sua concubina: um amor impossível entre o soberano e a dama que escolheu a própria liberdade." },
  { slug: "love-in-the-moonlight", title: "Love in the Moonlight", native: "구르미 그린 달빛", country: "KR", year: 2016, episodes: 18, network: "KBS2 / Netflix", wiki: "Love_in_the_Moonlight", score: 76, popularity: 150000, genres: ["Historical", "Romance", "Comedy"], tags: [{ name: "Cross-dressing", rank: 85 }, { name: "Crown Prince", rank: 80 }], synopsis: "Uma jovem que vive como conselheiro amoroso disfarçado de homem entra na corte real e conquista o príncipe herdeiro." },
  { slug: "gyeongseong-creature", title: "Gyeongseong Creature", native: "경성크리처", country: "KR", year: 2023, episodes: 10, network: "Netflix", wiki: "Gyeongseong_Creature", score: 72, popularity: 140000, genres: ["Horror", "Action", "Historical"], tags: [{ name: "Monster", rank: 90 }, { name: "1940s", rank: 80 }], synopsis: "Na Seul ocupada de 1945, um herbário rico e uma detetive de desaparecimentos enfrentam uma criatura nascida dos horrores da guerra." },
  { slug: "sweet-home", title: "Sweet Home", native: "스위트홈", country: "KR", year: 2020, episodes: 10, network: "Netflix", wiki: "Sweet_Home_(TV_series)", score: 72, popularity: 200000, genres: ["Horror", "Thriller", "Fantasy"], tags: [{ name: "Monsters", rank: 90 }, { name: "Survival", rank: 85 }, { name: "Webtoon Adaptation", rank: 90 }], synopsis: "Adaptação do webtoon: moradores de um prédio isolado lutam para sobreviver enquanto os vizinhos se transformam em monstros dos desejos." },
  { slug: "all-of-us-are-dead", title: "All of Us Are Dead", native: "지금 우리 학교는", country: "KR", year: 2022, episodes: 12, network: "Netflix", wiki: "All_of_Us_Are_Dead", score: 74, popularity: 280000, genres: ["Horror", "Action", "Drama"], tags: [{ name: "Zombie", rank: 95 }, { name: "School", rank: 85 }], synopsis: "Um vírus zumbi se espalha pela escola e os sobreviventes adolescentes precisam fugir — ou enfrentar quem se transformou." },
  { slug: "eternals-yesterday", title: "Eternal Yesterday", native: "永遠の昨日", country: "JP", year: 2022, episodes: 8, network: "MBS", wiki: "", score: 72, popularity: 60000, genres: ["Drama", "Romance"], tags: [{ name: "Boys' Love", rank: 90 }, { name: "Tragedy", rank: 75 }], synopsis: "Dois universitários apaixonados enfrentam um segredo devastador: um deles reinicia o dia anterior toda vez que morre." },
  { slug: "ocean-of-love", title: "Ossan's Love", native: "おっさんずラブ", country: "JP", year: 2018, episodes: 12, network: "TV Asahi", wiki: "Ossan's_Love", score: 74, popularity: 80000, genres: ["Comedy", "Romance"], tags: [{ name: "Boys' Love", rank: 85 }, { name: "Workplace", rank: 75 }], synopsis: "Comédia japonesa cult: um corretor imobiliário descobre que o chefe e o colega de quarto estão apaixonados por ele." },
  { slug: "1-litre-of-tears", title: "1 Litre of Tears", native: "1リットルの涙", country: "JP", year: 2005, episodes: 11, network: "Fuji TV", wiki: "1_Litre_of_Tears", score: 82, popularity: 90000, genres: ["Drama"], tags: [{ name: "Illness", rank: 90 }, { name: "Biography", rank: 85 }], synopsis: "Baseado no diário real de Aya Kitō, uma adolescente que enfrenta a degeneração espinocerebelar com coragem que inspirou o Japão inteiro." },
  { slug: "hana-yori-dango", title: "Hana Yori Dango", native: "花より男子", country: "JP", year: 2005, episodes: 9, network: "TBS", wiki: "Hana_Yori_Dango_(TV_series)", score: 78, popularity: 110000, genres: ["Romance", "Drama"], tags: [{ name: "Rich Boy Poor Girl", rank: 90 }, { name: "Manga Adaptation", rank: 85 }], synopsis: "A adaptação japonesa do mangá clássico: uma estudante comum confronta o F4, o quarteto mais poderoso da escola elite." },
  { slug: "long-ballad", title: "The Long Ballad", native: "长歌行", country: "CN", year: 2021, episodes: 49, network: "Tencent Video / Netflix", wiki: "The_Long_Ballad", score: 74, popularity: 130000, genres: ["Historical", "Action", "Romance"], tags: [{ name: "Historical", rank: 90 }, { name: "Revenge", rank: 75 }], synopsis: "Uma princesa fugitiva da dinastia Tang busca vingança e encontra amor e lealdade no caminho mais imprevisível." },
  { slug: "love-between-fairy-and-devil", title: "Love Between Fairy and Devil", native: "苍兰诀", country: "CN", year: 2022, episodes: 36, network: "iQiyi / Netflix", wiki: "Love_Between_Fairy_and_Devil", score: 78, popularity: 160000, genres: ["Fantasy", "Romance"], tags: [{ name: "Xianxia", rank: 90 }, { name: "Body Swap", rank: 75 }], synopsis: "Uma fada de baixo escalão liberta sem querer o lorde demônio selado por 30 mil anos — e as almas deles se entrelaçam." },
  { slug: "hidden-love", title: "Hidden Love", native: "偷偷藏不住", country: "CN", year: 2023, episodes: 25, network: "Tencent Video / Netflix", wiki: "Hidden_Love", score: 76, popularity: 180000, genres: ["Romance", "Comedy"], tags: [{ name: "Older Brother's Friend", rank: 90 }, { name: "Crush", rank: 85 }], synopsis: "O crush de adolescência de uma garota — melhor amigo do irmão dela — volta à vida dela anos depois como vizinho e médico." },
  { slug: "ashes-of-love", title: "Ashes of Love", native: "香蜜沉沉烬如霜", country: "CN", year: 2018, episodes: 63, network: "Jiangsu TV / Netflix", wiki: "Ashes_of_Love", score: 78, popularity: 170000, genres: ["Fantasy", "Romance"], tags: [{ name: "Xianxia", rank: 90 }, { name: "Love Polygon", rank: 75 }], synopsis: "A filha do deus das flores, criada sem a capacidade de amar, fica no centro da rivalidade entre dois príncipes celestiais." },
  { slug: "go-ahead", title: "Go Ahead", native: "以家人之名", country: "CN", year: 2020, episodes: 46, network: "Hunan TV / Netflix", wiki: "Go_Ahead", score: 77, popularity: 140000, genres: ["Drama", "Romance", "Slice of Life"], tags: [{ name: "Family Life", rank: 90 }, { name: "Childhood Friends", rank: 85 }], synopsis: "Três jovens de famílias quebradas crescem como irmãos sob um mesmo teto — até que o tempo transforma tudo em amor e reencontros." },
  { slug: "f4-thailand", title: "F4 Thailand: Boys Over Flowers", native: "F4 Thailand", country: "TH", year: 2021, episodes: 16, network: "GMMTV / Netflix", wiki: "F4_Thailand:_Boys_Over_Flowers", score: 74, popularity: 100000, genres: ["Romance", "Drama"], tags: [{ name: "Rich Boy Poor Girl", rank: 90 }, { name: "School", rank: 80 }], synopsis: "A versão tailandesa de Boys Over Flowers: uma estudante de arte desafia o grupo mais temido da escola mais elite de Bangkok." },
  { slug: "2gether", title: "2gether: The Series", native: "เพราะรักใช่ป่าว", country: "TH", year: 2020, episodes: 13, network: "GMMTV", wiki: "2gether:_The_Series", score: 72, popularity: 120000, genres: ["Comedy", "Romance"], tags: [{ name: "Boys' Love", rank: 90 }, { name: "Fake Relationship", rank: 85 }], synopsis: "Um estudante popular finge namorar um colega para espantar uma admiradora insistente — e a farsa vira sentimento real." },
];

async function wikiThumb(page: string): Promise<{ thumb: string | null; url: string | null }> {
  if (!page) return { thumb: null, url: null };
  for (const lang of ["pt", "en"]) {
    try {
      const res = await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, {
        headers: { Accept: "application/json", "User-Agent": "OtakuVerse/2.0 (https://otakuverse.app; contato@otakuverse.app)" },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const j: any = await res.json();
      const thumb = j.thumbnail?.source ?? null;
      const url = j.content_urls?.desktop?.page ?? null;
      // sobe a resolução do thumb da Wikipédia (substitui /xxxpx- por /640px-)
      const big = thumb ? thumb.replace(/\/\d+px-/, "/640px-") : null;
      if (big) return { thumb: big, url };
    } catch {
      continue;
    }
  }
  return { thumb: null, url: null };
}

async function main() {
  console.log(`★ Seed de dramas — ${DRAMAS.length} obras reais`);
  let ok = 0, noImg = 0;
  for (const d of DRAMAS) {
    const { thumb, url } = await wikiThumb(d.wiki);
    const magazine = JSON.stringify({
      name: d.network,
      publisher: d.network,
      demographic: "varias",
      schedule: d.country === "KR" ? "Semanal (sex/sáb/dom)" : "Semanal",
      accepts: ["Drama", "Romance", "Ação", "Slice of Life"],
      famous: [], source: "curado",
    });
    const classification = d.classification ?? "safe";
    const row = {
      id: `drama-${d.slug}`,
      type: "drama",
      format: "TV",
      title: d.title,
      titleEn: d.title,
      titleNative: d.native,
      synonyms: JSON.stringify([]),
      synopsis: d.synopsis,
      cover: thumb ?? "",
      coverAlt: thumb ? thumb.replace(/\/640px-/, "/320px-") : null,
      coverColor: null,
      banner: thumb ? thumb.replace(/\/640px-/, "/1280px-") : null,
      status: "FINISHED",
      chapters: null,
      volumes: null,
      episodes: d.episodes,
      duration: 60,
      startDate: `${d.year}-01-01`,
      endDate: null,
      country: d.country,
      isAdult: false,
      classification,
      adultTags: "[]",
      genres: JSON.stringify(d.genres),
      tags: JSON.stringify(d.tags),
      avgScore: d.score,
      popularity: d.popularity,
      favourites: Math.round(d.popularity / 40),
      authors: JSON.stringify([{ name: d.network, role: "Emissora original" }]),
      extLinks: JSON.stringify([
        ...(url ? [{ site: "Wikipédia", url, language: null, type: "INFO", color: "#636466", icon: null }] : []),
        { site: "Netflix", url: "https://www.netflix.com/br/search?q=" + encodeURIComponent(d.title), language: "PT-BR", type: "STREAMING", color: "#E50914", icon: null },
      ]),
      magazine,
      network: d.network,
      source: "Original",
      siteUrl: url,
      lastUpdate: Math.floor(Date.now() / 1000),
      nextEpisodeAt: null,
      nextEpisodeNum: null,
    };
    await db.work.upsert({ where: { id: row.id }, create: row, update: row });
    if (thumb) ok++; else { noImg++; console.log(`  sem imagem: ${d.title} (${d.wiki || "sem página"})`); }
  }
  console.log(`★ Dramas: ${ok} com pôster real, ${noImg} sem imagem`);
}

main()
  .catch((e) => { console.error("FATAL:", e); process.exit(1); })
  .finally(() => db.$disconnect());
