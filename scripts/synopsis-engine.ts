// Engine de sinopses PT-BR determinísticas e gramaticalmente seguras.
// Fragmentos 100% pré-escritos (nenhum encaixe de artigo solto) — usada pelo
// backfill das 24.000 obras procedurais e pelo gerador de catálogo.

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES_JP = ["Kaito", "Hikari", "Ren", "Yuki", "Sora", "Aoi", "Rin", "Haruto", "Mei", "Akira", "Yuna", "Kenji", "Nao", "Riku", "Sakura", "Taiga", "Io", "Chiaki"];
const FAMILY_JP = ["Akiyama", "Kurosawa", "Shirakawa", "Tsukishima", "Hoshino", "Amagiri", "Fujimori", "Natsume", "Kirigaya", "Sakuraba"];
const NAMES_KR = ["Jiwoo", "Hayoon", "Seojun", "Minjae", "Dayeon", "Junho", "Sua", "Gunwoo", "Nari", "Taeyang"];
const FAMILY_KR = ["Kim", "Lee", "Park", "Choi", "Jung", "Han", "Seo", "Oh"];
const NAMES_CN = ["Wei", "Xiao Lan", "Jun", "Mei", "Feng", "Yun", "Lei", "Hua"];
const FAMILY_CN = ["Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Xu"];

// Buckets temáticos — cada frase é autocontida e gramaticalmente correta.
const BUCKETS: Record<string, { setting: string[]; drive: string[]; conflict: string[] }> = {
  acao: {
    setting: [
      "Depois que a Fratura partiu o céu ao meio, o mundo se acostumou a conviver com portais, dungeons e monstros entre os arranha-céus.",
      "Em um continente onde o poder de combate define tudo — títulos, territórios e até casamentos —, nascer fraco é quase uma sentença.",
      "As guildas comandam a economia, os rankings decidem reputação e cada catacumba esconde um chefe que já devorou esquadrões inteiros.",
    ],
    drive: [
      "{nome} treina em segredo todas as noites, carregando uma promessa que ninguém mais teve coragem de fazer.",
      "Rejeitado por todas as guildas da região, {nome} jura subir do último posto ao topo — sozinho, se precisar ser.",
      "Quando a irmã adoece, {nome} aceita a única missão que ninguém quis: explorar o andar que já matou três gerações de aventureiros.",
    ],
    conflict: [
      "Cada vitória chama atenção de rivais mais fortes, e o abismo entre talento e esforço começa a ser cobrado em sangue.",
      "Logo o mundo percebe que o improvável novato está quebrando todos os recordes — e nem todos querem torcer por ele.",
      "Entre traições de aliados e chefes que aprendem com cada derrota, sobreviver já é vencer.",
    ],
  },
  romance: {
    setting: [
      "Entre o segundo ano do colégio e o festival cultural que se aproxima, tudo em volta parece conspirar para juntar pessoas que se evitam.",
      "Na calmaria de uma cidade litorânea onde todo mundo se conhece, um reencontro inesperado mexe com sentimentos enterrados há anos.",
      "Um apartamento apertado, um contrato de aluguel improvável e duas pessoas completamente opostas dividindo a mesma porta.",
    ],
    drive: [
      "{nome} decide que, nesta vida, vai dizer o que sente — mesmo que a voz trema toda vez.",
      "Depois de um desentendimento humilhante, {nome} jura manter distância; o destino decide o contrário.",
      "Com o coração ainda em recuperação, {nome} promete a si mesmo que não vai se apaixonar tão cedo.",
    ],
    conflict: [
      "Mal-entendidos se acumulam como chuva de monção, e cada silêncio custa mais caro que uma confissão.",
      "Um rival inesperado aparece, o passado bate à porta, e apaixonar-se passa a ser o ato mais corajoso de todos.",
      "Entre mensagens não respondidas e encontros acidentais, os dois aprendem que amar também exige coragem de se expor.",
    ],
  },
  comedia: {
    setting: [
      "O clube mais improdutivo da escola ganha um gabinete, um orçamento ridículo e uma missão impossível de justificar.",
      "Uma lojinha de bairro à beira da falência contrata seu pior cliente como funcionário — e a confusão vira rotina.",
      "Num prédio onde cada vizinho esconde um talento absurdo, o andar de cima sempre tem mais problema que o anterior.",
    ],
    drive: [
      "{nome} só queria uma vida tranquila; a sorte insiste em transformar cada terça-feira em caos.",
      "Com o orgulho ferido e a carteira vazia, {nome} aceita qualquer trabalho — e sempre dá errado do jeito mais engraçado possível.",
      "{nome} decide provar que é normal como qualquer pessoa; cada tentativa só piora a reputação.",
    ],
    conflict: [
      "Quanto mais eles tentam consertar as coisas, mais elaborado fica o desastre — e melhor a história.",
      "As situações fogem do controle na mesma velocidade em que o grupo se torna, sem admitir, uma família.",
      "No fim, o problema nunca é o que parece — e a solução é sempre mais absurda que a dúvida.",
    ],
  },
  sombrio: {
    setting: [
      "A cidade nunca dorme, mas também nunca conta a verdade: cada distrito esconde um caso que a polícia aprendeu a ignorar.",
      "Num mundo onde a mente é a última fronteira, dominar o próprio medo virou a única moeda que ainda vale algo.",
      "Depois do apagão que durou sete anos, a verdade virou mercadoria e a memória, campo de batalha.",
    ],
    drive: [
      "{nome} investiga o desaparecimento que todos fingem não ter acontecido — inclusive quem deveria ajudar.",
      "Marcado por um passado que prefere esquecer, {nome} segue o único fio que ainda faz sentido: a verdade.",
      "Quando o único amigo restante vira o principal suspeito, {nome} passa a caçar respostas em lugares que dão arrepio.",
    ],
    conflict: [
      "Cada resposta custa uma certeza, e o culpado parece sempre um passo à frente.",
      "A linha entre caçador e presa fica mais fina a cada capítulo — e o leitor só percebe quando já é tarde.",
      "Quem mente menos ainda mente; quem confia mais ainda erra. É nesse jogo que {nome} precisa vencer.",
    ],
  },
  fantasia: {
    setting: [
      "Em um reino onde magia é herança de sangue, nascer sem nenhum dom é tão raro quanto perigoso.",
      "Entre torres flutuantes, florestas que mudam de lugar e dragões aposentados, o mundo guarda espaço até para quem ninguém espera.",
      "A Academia Real forma heróis há três séculos; o problema é o que sobra de fora dela.",
    ],
    drive: [
      "{nome} descobre um grimório antigo que responde às próprias dúvidas — e às perguntas que nem deveria fazer.",
      "Com um contrato incomum assinado com uma criatura falante, {nome} ganha poder, dívida e companhia na mesma dose.",
      "Rejeitada pela elite, {nome} aposta no caminho esquecido: estudar a magia que todos desistiram de entender.",
    ],
    conflict: [
      "O poder cresce, e com ele cresce a atenção da coroa — nem toda atenção é bom agouro.",
      "Enquanto descobre os limites do próprio dom, {nome} encontra os limites do sistema que jurou proteger todos.",
      "Cada segredo revelado rearranja o tabuleiro político do reino, e peças pequenas começam a mover o jogo.",
    ],
  },
  scifi: {
    setting: [
      "Em 2199, a humanidade espalhou-se por três estações orbitais — e descobriu que solidão também escala.",
      "A megacorporação controla o ar, a água e os anúncios; o resto é território livre, desde que ninguém olhe demais.",
      "Num mundo onde memórias podem ser salvas, editadas e vendidas, quem controla o backup controla o passado.",
    ],
    drive: [
      "{nome} é engenheira de manutenção dos sistemas que mantêm a estação viva — até perceber que alguém está editando os logs.",
      "Depois de um acidente que ninguém mais lembra, {nome} passa a caçar as brechas entre uma atualização e outra.",
      "{nome} aceita um contrato simples de entrega; o pacote, claro, muda tudo.",
    ],
    conflict: [
      "A cada patch, a realidade fica um pouco mais conveniente — e conveniência demais sempre esconde alguém lucrando.",
      "Entre drones, contratos de sangue digital e alianças que expiram, sobreviver exige atualizar mais rápido que o sistema.",
      "A pergunta deixa de ser \"quem fez?\" e vira \"quem autorizou?\" — e a resposta é pior que a dúvida.",
    ],
  },
  cotidiano: {
    setting: [
      "Entre provas, turnos de meio período e o trem das 7h12, a vida segue — e é exatamente aí que ela acontece.",
      "Uma cafeteria de esquina, clientes recorrentes e conversas que começam pequenas e terminam grandes.",
      "O verão passa devagar na cidade interiorana, onde os dias parecem iguais e nunca são.",
    ],
    drive: [
      "{nome} decide registrar um ano inteiro da própria vida em um caderno comprado por impulso.",
      "Depois de se mudar sozinho pela primeira vez, {nome} aprende que crescer é feito de metade rotina, metade coragem.",
      "Com o clube prestes a fechar por falta de membros, {nome} reúne o grupo mais imprevisível que a escola já viu.",
    ],
    conflict: [
      "Nada explode, nada salva o mundo — e mesmo assim cada capítulo pesa no peito do jeito certo.",
      "As pequenas vitórias somam: uma amizade consertada, um medo vencido, um jantar que deu certo.",
      "Aos poucos, a história prova que cotidiano também é enredo, e que gente muda devagar — mas muda.",
    ],
  },
  cultivo: {
    setting: [
      "No Pico dos Nove Trovões, quanto mais alto o escalão, mais fundo o abismo — e os dois caem com a mesma facilidade.",
      "Num império governado por seitas imortais, talento sem protector morre jovem; é a primeira lição e a última.",
      "As provações do Céu não perdoam, as seitas não esquecem e a vingança tem longa validade.",
    ],
    drive: [
      "Traído na véspera do exame interno, {nome} jura recuperar tudo o que foi roubado — com juros.",
      "Herdeiro de uma técnica considerada inútil, {nome} treina em segredo o caminho que todos abandonaram.",
      "Reencarnado com as memórias de uma vida inteira, {nome} conhece cada armadilha do caminho — e vai usar isso.",
    ],
    conflict: [
      "A cada reino de cultivo alcançado, o mundo revela um inimigo mais antigo e uma aposta mais alta.",
      "Entre torneios, tesouros herdados e seitas rivais, manter o rosto é tão importante quanto manter o fôlego.",
      "O caminho da imortalidade cobra em solidariedade: quem sobe, sobe pisando em promessas.",
    ],
  },
  esporte: {
    setting: [
      "Falta um ano para as seletivas nacionais, e o time mais zombado da região recebe uma transferência improvável.",
      "Na quadra, no tatame ou na piscina, o cronômetro não se importa com a sua história — só com o seu tempo.",
      "O ginásio da escola fede a mofo e sonho antigo; é ali que tudo vai ser decidido de novo.",
    ],
    drive: [
      "Depois da lesão que encerrou a promissora carreira juvenil, {nome} aceita treinar quem um dia foi rival.",
      "{nome} nunca entrou em uma competição oficial; a meta agora é simples e absurda: vencer a primeira.",
      "Com o recorde da irmã mais velha pendurado na parede, {nome} treina para bater exatamente aquele número.",
    ],
    conflict: [
      "Cada partida custa suor, orgulho e às vezes amizade — e o placar nunca mente.",
      "O rival aparece com técnica nova, o time discute em pleno aquecimento, e a superação vira rotina.",
      "No esporte, como na história, ninguém ganha sozinho — aprender isso custa uma temporada inteira.",
    ],
  },
  generico: {
    setting: [
      "Num mundo que já viu de tudo, sobrou espaço para quem enxerga o que os outros ignoram.",
      "A cidade parece comum aos olhos apressados; basta um dia mais longo para provar o contrário.",
      "Entre o que o mundo promete e o que ele entrega, mora a história desta obra.",
    ],
    drive: [
      "{nome} carrega uma habilidade pequena demais para impressionar e útil demais para ignorar.",
      "Sem grandes planos, {nome} aceita o primeiro trabalho que aparece — e ele muda a rota de tudo.",
      "{nome} decide recomeçar de onde parou; o mundo, é claro, tinha outros planos.",
    ],
    conflict: [
      "A cada resposta, uma pergunta maior; a cada aliado, um interesse diferente.",
      "O passado cobra juros, o presente não espera e o futuro cobra passagem.",
      "Quando o segredo finalmente aparece, não existe mais caminho de volta — só a escolha de como seguir.",
    ],
  },
};

const GENRE_BUCKET: [string, string][] = [
  ["Cultivo", "cultivo"], ["Xianxia", "cultivo"], ["Progressão", "cultivo"], ["Artes Marciais", "cultivo"],
  ["Romance", "romance"],
  ["Comédia", "comedia"],
  ["Terror", "sombrio"], ["Suspense", "sombrio"], ["Psicológico", "sombrio"], ["Mistério", "sombrio"], ["Crime", "sombrio"],
  ["Ficção Científica", "scifi"], ["Mecha", "scifi"], ["Cyberpunk", "scifi"],
  ["Ação", "acao"], ["Aventura", "acao"], ["Isekai", "acao"], ["Fantasia Sombria", "acao"], ["Sobrenatural", "acao"],
  ["Fantasia", "fantasia"],
  ["Esportes", "esporte"],
  ["Slice of Life", "cotidiano"], ["Drama", "cotidiano"],
];

const HOOKS = [
  "Ritmo ágil, elenco carismático e reviravoltas que respeitam o leitor desde o primeiro arco.",
  "Os capítulos são curtos, precisos e feitos para maratonar — comece um e verá que não para por aí.",
  "Entre momentos de leveza e cenas de tirar o ar dos pulmões, a obra equilibra entretenimento e emoção.",
  "Indicada para quem gosta de protagonistas que erram, aprendem e voltam mais fortes.",
  "A construção de mundo é gradual e recompensadora: cada detalhe plantado cedo floresce no momento certo.",
  "A arte carrega as emoções das cenas-chave, e os intervalos entre releases viram assunto garantido entre fãs.",
];

const SPICY_SOFT = [
  "O humor safado e as situações constrangedoras garantem o fanservice sem perder o charme.",
  "Cenas de praia, onsen e quartos divididos fazem parte do pacote — com muito more ao redor.",
  "A tensão romântica vem acompanhada de um ecchi proposital, que sabe a hora de aparecer e a hora de sair de cena.",
];

const SPICY_ADULT = [
  "Conteúdo explícito faz parte da narrativa, com cenas adultas integradas ao desenvolvimento dos personagens.",
  "Obra destinada ao público adulto: linguagem, cenas e temas exigem maturidade — e dizem exatamente o que vieram dizer.",
];

export interface SynthInput {
  id: string;
  type: string;
  country?: string | null;
  genresJson?: string | null;
  spicy?: number | null;
  status?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  episodes?: number | null;
}

function nome(country: string | null | undefined, r: () => number, pick: <T>(a: T[]) => T): string {
  if (country === "KR") return `${pick(FAMILY_KR)} ${pick(NAMES_KR)}`;
  if (country === "CN") return `${pick(FAMILY_CN)} ${pick(NAMES_CN)}`;
  return `${pick(FAMILY_JP)} ${pick(NAMES_JP)}`;
}

function pluralCap(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Gera sinopse PT-BR coerente, determinística por id. */
export function buildSynopsis(input: SynthInput): string {
  const r = mulberry32(hashStr(input.id));
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];

  // bucket dominante pelos gêneros
  let bucket = "generico";
  try {
    const genres: string[] = JSON.parse(input.genresJson || "[]");
    outer: for (const g of genres) {
      for (const [key, b] of GENRE_BUCKET) {
        if (g.toLowerCase().includes(key.toLowerCase())) { bucket = b; break outer; }
      }
    }
  } catch { /* mantém genérico */ }

  const b = BUCKETS[bucket] ?? BUCKETS.generico;
  const prot = nome(input.country, r, pick);
  const setting = pick(b.setting);
  const drive = pick(b.drive).replace("{nome}", prot);
  const conflict = pick(b.conflict).replace("{nome}", prot);
  const parts = [setting, drive, conflict];

  if (r() < 0.75) parts.push(pick(HOOKS));
  if ((input.spicy ?? 0) === 1 && r() < 0.8) parts.push(pick(SPICY_SOFT));
  if ((input.spicy ?? 0) === 2) parts.push(pick(SPICY_ADULT));

  // linha de estado factual
  if (r() < 0.8) {
    if (input.type === "anime" && input.episodes) {
      parts.push(`A adaptação animada tem ${pluralCap(input.episodes, "episódio", "episódios")} e estreia marcada para em breve.`);
    } else if (input.type === "lightnovel" && input.volumes) {
      parts.push(
        input.status === "RELEASING"
          ? `Até agora são ${pluralCap(input.volumes, "volume", "volumes")} publicados, com novos capítulos chegando regularmente.`
          : `A série soma ${pluralCap(input.volumes, "volume", "volumes")} publicados.`
      );
    } else if (input.chapters) {
      parts.push(
        input.status === "RELEASING"
          ? `Já são ${pluralCap(input.chapters, "capítulo", "capítulos")} publicados — e a serialização continua a todo vapor.`
          : `A obra está concluída, com ${pluralCap(input.chapters, "capítulo", "capítulos")} no total.`
      );
    }
  }

  return parts.join(" ");
}
