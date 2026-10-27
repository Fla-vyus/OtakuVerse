// ============================================================================
// tagmap — Sistema de tags em PT-BR do OtakuVerse
// - Tradução de gêneros e tags da AniList para português
// - Categorias para navegação agrupada
// - Derivação de tags obrigatórias: Ecchi, Hentai, +18 (+ outras úteis)
// ============================================================================

/** Gêneros AniList → PT-BR */
export const GENRE_PT: Record<string, string> = {
  Action: "Ação",
  Adventure: "Aventura",
  Comedy: "Comédia",
  Drama: "Drama",
  Ecchi: "Ecchi",
  Fantasy: "Fantasia",
  Hentai: "Hentai",
  Horror: "Terror",
  "Mahou Shoujo": "Magical Girl",
  Mecha: "Mecha",
  Music: "Música",
  Mystery: "Mistério",
  Psychological: "Psicológico",
  Romance: "Romance",
  "Sci-Fi": "Ficção Científica",
  "Slice of Life": "Cotidiano",
  Sports: "Esportes",
  Supernatural: "Sobrenatural",
  Thriller: "Suspense",
};

/** Tags AniList → PT-BR (as ~170 mais frequentes do acervo) */
export const TAG_PT: Record<string, string> = {
  "Male Protagonist": "Protagonista Masculino",
  "Female Protagonist": "Protagonista Feminina",
  School: "Escolar",
  Shoujo: "Shoujo",
  Seinen: "Seinen",
  Heterosexual: "Casal Hétero",
  "Full Color": "Colorido",
  Shounen: "Shounen",
  "Boys' Love": "Boys' Love",
  "Primarily Adult Cast": "Elenco Adulto",
  Magic: "Magia",
  Josei: "Josei",
  "Primarily Female Cast": "Elenco Feminino",
  Historical: "Histórico",
  Tragedy: "Tragédia",
  Isekai: "Isekai",
  Yuri: "Yuri",
  Anthology: "Antologia",
  Nudity: "Nudez",
  "Long Strip": "Formato Vertical",
  "Primarily Teen Cast": "Elenco Jovem",
  Animals: "Animais",
  "Love Triangle": "Triângulo Amoroso",
  Demons: "Demônios",
  "Female Harem": "Harem Feminino",
  "Primarily Male Cast": "Elenco Masculino",
  Work: "Trabalho",
  "Super Power": "Superpoderes",
  "Age Gap": "Diferença de Idade",
  Foreign: "Estrangeiro",
  "Ensemble Cast": "Elenco Coral",
  "Urban Fantasy": "Fantasia Urbana",
  Reincarnation: "Reencarnação",
  "LGBTQ+ Themes": "Temas LGBTQ+",
  Urban: "Urbano",
  Swordplay: "Espadas",
  Gore: "Gore",
  Episodic: "Episódico",
  "Coming of Age": "Amadurecimento",
  "Family Life": "Vida em Família",
  Food: "Gastronomia",
  Revenge: "Vingança",
  "Time Skip": "Salto no Tempo",
  Kids: "Infantil",
  "Time Manipulation": "Manipulação do Tempo",
  Crossdressing: "Travestismo",
  War: "Guerra",
  Military: "Militar",
  Guns: "Armas de Fogo",
  Tsundere: "Tsundere",
  Idol: "Ídolos",
  Gods: "Divindades",
  Bullying: "Bullying",
  Kuudere: "Kuudere",
  Crime: "Crime",
  "Martial Arts": "Artes Marciais",
  Aliens: "Aliens",
  "School Club": "Clube Escolar",
  Parody: "Paródia",
  Ghost: "Fantasmas",
  Rural: "Rural",
  "Surreal Comedy": "Comédia Surreal",
  Slapstick: "Slapstick",
  "Cute Girls Doing Cute Things": "Fofura Cotidiana",
  Kemonomimi: "Kemonomimi",
  "Full CGI": "CGI Completo",
  Robots: "Robôs",
  "Anti-Hero": "Protagonista Sombrio",
  Henshin: "Henshin",
  Philosophy: "Filosofia",
  Politics: "Política",
  Amnesia: "Amnésia",
  Vampire: "Vampiros",
  CGI: "CGI",
  Space: "Espaço",
  Yandere: "Yandere",
  Suicide: "Suicídio",
  Dragons: "Dragões",
  "Gender Bending": "Troca de Gênero",
  Twins: "Gêmeos",
  Delinquents: "Delinquentes",
  College: "Faculdade",
  Detective: "Detetive",
  Youkai: "Youkai",
  "Post-Apocalyptic": "Pós-apocalíptico",
  "Unrequited Love": "Amor Não Correspondido",
  Chibi: "Chibi",
  Police: "Polícia",
  Teacher: "Professores",
  "Primarily Child Cast": "Elenco Infantil",
  "Body Horror": "Horror Corporal",
  Iyashikei: "Iyashikei",
  "4-koma": "Yonkoma",
  Conspiracy: "Conspiração",
  "Royal Affairs": "Realeza",
  Maids: "Empregadas",
  Meta: "Metalinguagem",
  Travel: "Viagens",
  Shapeshifting: "Metamorfose",
  Anthropomorphism: "Antropomorfismo",
  Drawing: "Desenho",
  Mythology: "Mitologia",
  "Otaku Culture": "Cultura Otaku",
  Survival: "Sobrevivência",
  Witch: "Bruxas",
  "Found Family": "Família Escolhida",
  Tomboy: "Tomboy",
  Medieval: "Medieval",
  Disability: "Deficiência",
  "Video Games": "Games",
  "Monster Girl": "Monster Girl",
  Acting: "Atuação",
  "Office Lady": "Office Lady",
  "Age Regression": "Regressão de Idade",
  Assassins: "Assassinos",
  Bisexual: "Bissexual",
  Cultivation: "Cultivo",
  "Artificial Intelligence": "IA",
  Adoption: "Adoção",
  "Memory Manipulation": "Manipulação de Memória",
  Educational: "Educacional",
  Elf: "Elfos",
  Rape: "Estupro",
  "Male Harem": "Harem Masculino",
  Marriage: "Casamento",
  "Alternate Universe": "Universo Alternativo",
  "Ojou-sama": "Ojou-sama",
  Samurai: "Samurai",
  Villainess: "Vilã",
  Religion: "Religião",
  Zombie: "Zumbis",
  Dystopian: "Distopia",
  Orphan: "Órfãos",
  Medicine: "Medicina",
  Gyaru: "Gyaru",
  "Dissociative Identities": "Personalidades Múltiplas",
  "Virtual World": "Mundo Virtual",
  Nekomimi: "Nekomimi",
  Fugitive: "Foragidos",
  "Super Robot": "Super Robot",
  "Classic Literature": "Literatura Clássica",
  Yakuza: "Yakuza",
  Baseball: "Beisebol",
  "Real Robot": "Real Robot",
  "No Dialogue": "Sem Diálogos",
  Cohabitation: "Morando Juntos",
  Rehabilitation: "Reabilitação",
  Kaiju: "Kaiju",
  Band: "Banda",
  Tokusatsu: "Tokusatsu",
  Dancing: "Dança",
  Dungeon: "Dungeon",
  Angels: "Anjos",
  Ninja: "Ninja",
  Incest: "Incesto",
  Writing: "Escrita",
  Coastal: "Litoral",
  Slavery: "Escravidão",
  Superhero: "Super-heróis",
  Autobiographical: "Autobiográfico",
  "Time Loop": "Loop Temporal",
  "Otome Game": "Jogo Otome",
  "Visual Arts": "Artes Visuais",
  Volleyball: "Vôlei",
  "Tabletop RPG": "RPG de Mesa",
  Sextuplets: "Sextuplos",
  "Cheating Infidelity": "Traição",
  "Softcore Hentai": "Hentai Leve",
  "Archery": "Arquearia",
  "Card Battle": "Batalha de Cartas",
  "Cannibalism": "Canibalismo",
  "Body Swapping": "Troca de Corpos",
  "Cute Boys Doing Cute Things": "Fofura Masculina",
  "Shota": "Shota",
  "Loli": "Loli",
  "Fitness": "Academia",
  "Swimming": "Natação",
  "Soccer": "Futebol",
  "Basketball": "Basquete",
  "Tennis": "Tênis",
  "Videogame": "Games",
  "Motorcycle": "Motocicletas",
  "Cars": "Carros",
  "Culinary": "Gastronomia",
  "Pirates": "Piratas",
  "Circus": "Circo",
  "Calligraphy": "Caligrafia",
  "Villainous Protagonist": "Protagonista Vilão",
  "Amateur Art": "Arte Amadora",
  "Fashion": "Moda",
  "Swimsuit": "Trajes de Banho",
  "Mobster": "Máfia",
  "Musical": "Musical",
  "Photography": "Fotografia",
  "Crossover": "Crossover",
  "Streaming": "Streaming",
  "Environmental": "Meio Ambiente",
  "Gag Humor": "Humor de Piada",
  "Iyashikei ": "Iyashikei",
  "Battle Royale": "Batalha Real",
  "Tanned Skin": "Pele Bronzeada",
  "Shounen Ai": "Shounen Ai",
  "Shoujo Ai": "Shoujo Ai",
  "Bara": "Bara",
  "Tall Girl": "Mulher Alta",
  "Short Girl": "Mulher Baixinha",
  "Reverse Harem": "Harem Reverso",
  "Polyamory": "Poliamor",
  "Skeleton": "Esqueletos",
  "Cultivator": "Cultivo",
  "Fishing": "Pesca",
  "Camping": "Acampamento",
  "Gambling": "Apostas",
  "Chess": "Xadrez",
  "Karuta": "Karuta",
  "Go": "Go",
  "Shogi": "Shogi",
  "Archaeology": "Arqueologia",
  "Program": "Programação",
};

/** Tags de conteúdo adulto/explícito — usadas na derivação do gate +18 */
export const ADULT_TAGS = new Set([
  "Nudity",
  "Rape",
  "Incest",
  "Sexual Violence",
  "Loli",
  "Shota",
  "Softcore Hentai",
  "Cheating Infidelity",
]);

/** Derivação "+18": obra marca como adulta pela AniList OU com tags explícitas fortes */
export function isAdultLike(w: { isAdult?: boolean; genres?: string[]; tags?: { name: string; rank: number }[] }): boolean {
  if (w.isAdult) return true;
  if (w.genres?.includes("Hentai")) return true;
  const tags = w.tags ?? [];
  for (const t of tags) {
    if (t.name === "Nudity" && t.rank >= 78) return true;
    if (t.name === "Rape" && t.rank >= 60) return true;
    if (t.name === "Sexual Violence" && t.rank >= 80) return true;
    if (t.name === "Softcore Hentai" && t.rank >= 60) return true;
  }
  return false;
}

/** Categorias para agrupar tags na UI de descoberta */
export const TAG_CATEGORIES: { id: string; label: string; emoji: string; match: string[] }[] = [
  { id: "adulto", label: "Conteúdo adulto", emoji: "🔞", match: ["+18", "Hentai", "Ecchi", "Nudez", "Estupro", "Incesto", "Violência Sexual", "Hentai Leve", "Loli", "Shota", "Traição"] },
  { id: "publico", label: "Público & demografia", emoji: "🧭", match: ["Shounen", "Shoujo", "Seinen", "Josei", "Infantil", "Kids", "Elenco Jovem", "Elenco Adulto", "Elenco Infantil"] },
  { id: "romance", label: "Romance & relacionamento", emoji: "💗", match: ["Romance", "Boys' Love", "Yuri", "Triângulo Amoroso", "Harem Feminino", "Harem Masculino", "Harem Reverso", "Casamento", "Amor Não Correspondido", "Morando Juntos", "Poliamor", "Casal Hétero", "Bissexual", "Temas LGBTQ+", "Diferença de Idade", "Vilã", "Jogo Otome"] },
  { id: "tema", label: "Temas & mundos", emoji: "🌍", match: ["Isekai", "Reencarnação", "Cultivo", "Magia", "Fantasia Urbana", "Histórico", "Militar", "Guerra", "Política", "Mitologia", "Divindades", "Demônios", "Vampiros", "Fantasmas", "Youkai", "Dragões", "Aliens", "Espaço", "Zumbis", "Pós-apocalíptico", "Distopia", "Sobrevivência", "Dungeon", "Superpoderes", "Artes Marciais", "Espadas", "Ninja", "Samurai", "Assassinos", "Mecha", "Robôs", "IA", "Mundo Virtual", "Games", "Loop Temporal", "Manipulação do Tempo", "Salto no Tempo", "Troca de Corpos", "Universo Alternativo", "Metamorfose", "Bruxas", "Elfos", "Kemonomimi", "Nekomimi", "Monster Girl", "Anjos", "Kaiju", "Tokusatsu", "Super-heróis", "Realeza", "Medieval", "Rural", "Urbano", "Litoral", "Escolar", "Clube Escolar", "Faculdade", "Trabalho", "Office Lady", "Empregadas", "Professores", "Gastronomia", "Medicina", "Educacional", "Viagens", "Religião", "Filosofia", "Conspiração", "Crime", "Polícia", "Detetive", "Yakuza", "Máfia", "Piratas", "Foragidos", "Literatura Clássica", "Escravidão", "Cultura Otaku", "Metalinguagem", "Paródia", "Antologia", "Yonkoma", "Desenho", "Escrita", "Fotografia", "Música", "Banda", "Ídolos", "Dança", "Atuação", "Moda", "Animais", "Antropomorfismo", "Meio Ambiente"] },
  { id: "acao", label: "Ação & tensão", emoji: "⚔️", match: ["Ação", "Aventura", "Suspense", "Terror", "Mistério", "Psicológico", "Gore", "Horror Corporal", "Armas de Fogo", "Bullying", "Suicídio", "Tragédia", "Vingança", "Amnésia", "Batalha Real", "Canibalismo"] },
  { id: "cotidiano", label: "Cotidiano & sentimento", emoji: "🍵", match: ["Cotidiano", "Iyashikei", "Fofura Cotidiana", "Fofura Masculina", "Comédia", "Drama", "Amadurecimento", "Vida em Família", "Família Escolhida", "Adoção", "Órfãos", "Casamento", "Gêmeos", "Tomboy", "Gyaru", "Ojou-sama", "Tsundere", "Kuudere", "Yandere", "Delinquentes", "Travestismo", "Troca de Gênero", "Regressão de Idade", "Personalidades Múltiplas", "Deficiência", "Reabilitação", "Slapstick", "Humor de Piada", "Comédia Surreal", "Chibi", "Autobiográfico", "Episódico", "Sem Diálogos", "Camping", "Pesca", "Academia", "Natação", "Futebol", "Beisebol", "Basquete", "Vôlei", "Tênis", "Esportes", "Arquearia", "Karuta", "Go", "Shogi", "Xadrez", "Apostas", "RPG de Mesa", "Batalha de Cartas", "Motocicletas", "Carros", "Magical Girl"] },
  { id: "formato", label: "Formato & estética", emoji: "🎨", match: ["Colorido", "Formato Vertical", "CGI", "CGI Completo", "Shounen Ai", "Shoujo Ai", "Bara", "Mulher Alta", "Mulher Baixinha", "Pele Bronzeada", "Trajes de Banho", "Elenco Coral", "Protagonista Masculino", "Protagonista Feminina", "Elenco Feminino", "Elenco Masculino", "Protagonista Sombrio", "Protagonista Vilão", "Estrangeiro"] },
];

/** Rótulos de categoria por id (fallback de exibição) */
export const TAG_CAT_LABEL: Record<string, string> = Object.fromEntries(
  TAG_CATEGORIES.map((c) => [c.id, `${c.emoji} ${c.label}`])
);

/**
 * Constrói a lista de tags PT-BR de uma obra:
 * gêneros traduzidos + tags traduzidas (rank >= 40) + derivadas obrigatórias.
 */
export function buildPtTags(w: {
  genres?: string[];
  tags?: { name: string; rank: number }[];
  isAdult?: boolean;
  source?: string | null;
  type?: string;
}): string[] {
  const out: string[] = [];
  const push = (t: string) => {
    if (t && !out.includes(t)) out.push(t);
  };

  // 1. Derivadas obrigatórias (prioridade máxima de descoberta)
  const genres = w.genres ?? [];
  const tags = w.tags ?? [];
  const adult = isAdultLike({ isAdult: w.isAdult, genres, tags });
  if (genres.includes("Ecchi")) push("Ecchi");
  if (adult) push("+18");
  if (genres.includes("Hentai")) push("Hentai");

  // 2. Gêneros traduzidos
  for (const g of genres) push(GENRE_PT[g] ?? g);

  // 3. Tags traduzidas (relevância mínima 40)
  for (const t of tags) {
    if (t.rank >= 40) push(TAG_PT[t.name] ?? t.name);
  }

  // 4. Derivadas de formato
  const tagNames = new Set(tags.map((t) => t.name));
  if (tagNames.has("Full Color")) push("Colorido");
  if (w.type === "manhwa") push("Webtoon");

  // 5. Derivadas de origem (source da AniList)
  switch (w.source) {
    case "MANGA": push("Baseado em Mangá"); break;
    case "LIGHT_NOVEL": push("Baseado em Light Novel"); break;
    case "WEB_NOVEL": push("Baseado em Web Novel"); break;
    case "VIDEO_GAME": push("Baseado em Jogo"); break;
    case "ORIGINAL": push("Original"); break;
    case "DOUJINSHI": push("Doujinshi"); break;
    case "MANGA_4KOMA": push("Yonkoma"); break;
    case "ANIME": push("Baseado em Anime"); break;
    case "NOVEL": push("Baseado em Novel"); break;
    case "COMIC": push("Baseado em HQ"); break;
    case "GAME": push("Baseado em Jogo"); break;
    case "VISUAL_NOVEL": push("Baseado em Visual Novel"); break;
  }

  return out;
}

/** Traduz um nome de gênero/tag para exibição (sem alterar a chave de filtro) */
export function displayTag(name: string): string {
  return GENRE_PT[name] ?? TAG_PT[name] ?? name;
}

/** Categorias de uma tag para a UI (ex.: saber se é adulto) */
export function tagCategory(name: string): string | null {
  for (const c of TAG_CATEGORIES) {
    if (c.match.includes(name)) return c.id;
  }
  return null;
}

/** Presets de descoberta rápida (chips de atalho) */
export const DISCOVERY_PRESETS: { label: string; emoji: string; tag: string; type?: string; sort?: string; desc: string }[] = [
  { label: "Ecchi", emoji: "🔥", tag: "Ecchi", sort: "favorites", desc: "fanservice e sensualidade com história" },
  { label: "+18", emoji: "🔞", tag: "+18", sort: "popular", desc: "conteúdo adulto do acervo" },
  { label: "Hentai", emoji: "💗", tag: "Hentai", sort: "popular", desc: "obras explícitas mais buscadas" },
  { label: "Isekai", emoji: "🌀", tag: "Isekai", desc: "portais e segundas chances" },
  { label: "Vilã", emoji: "👑", tag: "Vilã", desc: "otome, nobreza e vingança elegante" },
  { label: "Boys' Love", emoji: "💍", tag: "Boys' Love", desc: "romances entre homens" },
  { label: "Yuri", emoji: "🌷", tag: "Yuri", desc: "romances entre mulheres" },
  { label: "Cultivo", emoji: "⚡", tag: "Cultivo", desc: "wuxia, xianxia e poder infinito" },
  { label: "Reencarnação", emoji: "♻️", tag: "Reencarnação", desc: "recomeços e regredidos" },
  { label: "Colorido", emoji: "🎨", tag: "Colorido", desc: "tudo colorido e bonito" },
  { label: "Formato Vertical", emoji: "📱", tag: "Formato Vertical", desc: "webtoons no scroll infinito" },
  { label: "Vingança", emoji: "🗡️", tag: "Vingança", sort: "score", desc: "histórias de acerto de contas" },
  { label: "Horror", emoji: "👻", tag: "Terror", sort: "score", desc: "pra ler com a luz acesa" },
  { label: "Esportes", emoji: "🏐", tag: "Esportes", sort: "score", desc: "suar a camisa" },
];
