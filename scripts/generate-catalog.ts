// Gerador de catálogo procedural do OtakuVerse — v4
// Títulos ORIGINAIS (romaji JP / internacional EN p/ KR-CN + nativo), revistas reais,
// capas AI do banco public/covers e RNG por linha (nomes estáveis entre regenerações).
import { PrismaClient } from "@prisma/client";
import * as B from "./catalog-banks.ts";
import * as T from "./title-banks.ts";
import { MAGAZINES } from "../src/lib/magazines.ts";
import { buildSynopsis } from "./synopsis-engine.ts";

const db = new PrismaClient();

// ---------- RNG determinístico ----------
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
type RNG = () => number;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.replace(/\s+/g, " ").trim();

// ---------- Concordância PT ----------
const artL = (g: string) => (g === "f" ? "a" : "o");
const artCap = (g: string) => (g === "f" ? "A" : "O");
const deOf = (g: string) => (g === "f" ? "da" : "do");
function prepOf(prep: string, g: string): string {
  switch (prep) {
    case "Contra": return g === "f" ? "contra a" : "contra o";
    case "Com": return g === "f" ? "com a" : "com o";
    case "Por": return g === "f" ? "pela" : "pelo";
    case "Para": return g === "f" ? "para a" : "para o";
    case "Em": return g === "f" ? "na" : "no";
    case "De": return g === "f" ? "da" : "do";
    default: return "";
  }
}
/** Adjetivo PT em feminino quando necessário ("Negro"→"Negra") */
function femPt(adj: string, g: string): string {
  if (g !== "f") return adj;
  return adj.endsWith("o") ? adj.slice(0, -1) + "a" : adj;
}
const PARTICLES = new Set(["no", "wo", "wa", "to", "ni", "ui", "na"]);

interface TitleSet {
  title: string;
  titleEn: string | null;
  titleNative: string | null;
  synonyms: string[];
}

function abbreviate(main: string): string | null {
  const words = main.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
  if (words.length < 2 || words.length > 5) return null;
  const abbr = words
    .map((w) => (PARTICLES.has(w.toLowerCase()) ? w[0].toLowerCase() : w[0].toUpperCase()))
    .join("");
  return abbr.length >= 2 && abbr.length <= 6 ? abbr : null;
}

// ---------- Títulos: Japão (mangá, LN, anime) ----------
function jpTitle(r: RNG, type: string): TitleSet {
  let A = T.ENT_JP[Math.floor(r() * T.ENT_JP.length)];
  let Bn = T.ENT_JP[Math.floor(r() * T.ENT_JP.length)];
  while (Bn.ro === A.ro) Bn = T.ENT_JP[Math.floor(r() * T.ENT_JP.length)];
  const adjI = T.ADJ_I[Math.floor(r() * T.ADJ_I.length)];
  const adjN = T.ADJ_NA[Math.floor(r() * T.ADJ_NA.length)];
  const V = T.VERBS[Math.floor(r() * T.VERBS.length)];
  const P = T.PRON_JP[Math.floor(r() * T.PRON_JP.length)];
  const given = T.NAMES_JP[Math.floor(r() * T.NAMES_JP.length)];
  const fam = T.FAMILY_JP[Math.floor(r() * T.FAMILY_JP.length)];
  const N = r() < 0.5 ? given : fam;
  const PL = T.PLACES_JP[Math.floor(r() * T.PLACES_JP.length)];
  const E = T.ADJ_EN_INV[Math.floor(r() * T.ADJ_EN_INV.length)];

  let main = "", en = "", native = "", pt = "";
  const isLN = type === "lightnovel";
  const roll = r();

  const genitive = () => {
    main = `${Bn.ro} no ${A.ro}`;
    native = `${Bn.ja}の${A.ja}`;
    en = `The ${A.en} of the ${Bn.en}`;
    pt = `${artCap(A.g)} ${A.pt} ${deOf(Bn.g)} ${Bn.pt}`;
  };
  const adjPattern = (useNa: boolean) => {
    const adj = useNa ? adjN : adjI;
    main = useNa ? `${adj.ro} na ${A.ro}` : `${adj.ro} ${A.ro}`;
    native = useNa ? `${adj.ja}な${A.ja}` : `${adj.ja}${A.ja}`;
    en = `The ${adj.en} ${A.en}`;
    pt = `${artCap(A.g)} ${A.pt} ${femPt(adj.pt, A.g)}`;
  };
  const verbPattern = () => {
    main = `${Bn.ro} wo ${V.ro}`;
    native = `${Bn.ja}を${V.ja}`;
    en = `${V.enGer} the ${Bn.en}`;
    pt = V.ptPrep
      ? `${cap(V.ptGer)} ${prepOf(V.ptPrep, Bn.g)} ${Bn.pt}`
      : `${cap(V.ptGer)} ${artL(Bn.g)} ${Bn.pt}`;
  };
  const namePattern = () => {
    main = `${N.ro} no ${A.ro}`;
    native = `${N.ja}の${A.ja}`;
    en = `${N.ro}'s ${A.en}`;
    pt = `${artCap(A.g)} ${A.pt} de ${N.ro}`;
  };
  const placePattern = () => {
    main = `${PL.ro} no ${A.ro}`;
    native = `${PL.ja}の${A.ja}`;
    en = `The ${A.en} in ${PL.ro}`;
    pt = `${artCap(A.g)} ${A.pt} de ${PL.ro}`;
  };
  const pronPattern = () => {
    main = `${P.ro} wa ${A.ro} wo ${V.ro}`;
    native = `${P.ja}は${A.ja}を${V.ja}`;
    en = `I Will ${V.enBase} the ${A.en}`;
    pt = V.ptPrep
      ? `Eu Vou ${V.ptRoot} ${prepOf(V.ptPrep, A.g)} ${A.pt}`
      : `Eu Vou ${V.ptRoot} ${artL(A.g)} ${A.pt}`;
  };
  const triplePattern = () => {
    // terceiro slot diferente dos dois primeiros
    const C = T.ENT_JP[(T.ENT_JP.indexOf(Bn) + 17) % T.ENT_JP.length];
    main = `${A.ro} to ${Bn.ro} no ${C.ro}`;
    native = `${A.ja}と${Bn.ja}の${C.ja}`;
    en = `The ${C.en} of ${A.en} and ${Bn.en}`;
    pt = `${artCap(C.g)} ${C.pt} de ${A.pt} e ${Bn.pt}`;
  };

  if (isLN) {
    if (roll < 0.30) pronPattern();
    else if (roll < 0.52) triplePattern();
    else if (roll < 0.74) genitive();
    else if (roll < 0.9) adjPattern(r() < 0.6);
    else namePattern();
    if (r() < 0.32) {
      if (r() < 0.4) main = `Re: ${main}`;
      else main = `${main} ${["!!", "EX", "~After Story~", "ZERO", "+"][Math.floor(r() * 5)]}`;
    }
  } else if (roll < 0.26) genitive();
  else if (roll < 0.46) adjPattern(r() < 0.35);
  else if (roll < 0.64) verbPattern();
  else if (roll < 0.78) namePattern();
  else if (roll < 0.92) placePattern();
  else {
    // híbrido com palavra em inglês (estilo Blue Lock / Chainsaw Man)
    main = `${E.en} ${A.en}`;
    native = `${adjI.ja}${A.ja}`;
    en = main;
    pt = `${artCap(A.g)} ${A.pt} ${E.pt}`;
  }

  const synonyms: string[] = [`"${pt}" (PT-BR)`];
  if (!isLN) {
    const abbr = abbreviate(main);
    if (abbr && r() < 0.35) synonyms.push(abbr);
  }
  return { title: clean(main), titleEn: clean(en), titleNative: native, synonyms };
}

// ---------- Títulos: Coreia (manhwa) ----------
const KR_EN_TEMPLATES = 7;
const KR_VERBS = T.VERBS.filter((v) => !v.enBase.includes(" "));
/** 3ª pessoa do singular PT a partir do infinitivo (Proteger→Protege, Lutar→Luta) */
function pt3(v: string): string {
  if (v.endsWith("ir")) return v.slice(0, -2) + "e";
  if (v.endsWith("er")) return v.slice(0, -2) + "e";
  return v.slice(0, -1) + "a";
}
function krTitle(r: RNG): TitleSet {
  let A = T.ENT_KR[Math.floor(r() * T.ENT_KR.length)];
  let Bn = T.ENT_KR[Math.floor(r() * T.ENT_KR.length)];
  while (Bn.ja === A.ja) Bn = T.ENT_KR[Math.floor(r() * T.ENT_KR.length)];
  const usePlace = r() < 0.15;
  const PL = T.PLACES_KR[Math.floor(r() * T.PLACES_KR.length)];
  const V = KR_VERBS[Math.floor(r() * KR_VERBS.length)];
  const placeRo = usePlace ? PL.ro : null;

  const native = usePlace ? `${PL.ja}의 ${A.ja}` : `${Bn.ja}의 ${A.ja}`;
  const useRomaji = r() < 0.18;
  const enRoll = Math.floor(r() * KR_EN_TEMPLATES);
  const en =
    enRoll === 0 ? `The ${A.en} of ${usePlace ? PL.ro : `the ${Bn.en}`}`
    : enRoll === 1 ? `The ${placeRo ?? Bn.en}'s ${A.en}`
    : enRoll === 2 ? `${placeRo ?? Bn.en}: ${A.en}`
    : enRoll === 3 ? `Return of the ${A.en}`
    : enRoll === 4 ? `The ${A.en} Who ${V.enBase}s the ${Bn.en}`
    : enRoll === 5 ? `${A.en} Rising`
    : `${A.en} of the ${placeRo ?? Bn.en}`;
  const pt =
    enRoll === 0 ? (usePlace ? `${artCap(A.g)} ${A.pt} de ${PL.ro}` : `${artCap(A.g)} ${A.pt} ${deOf(Bn.g)} ${Bn.pt}`)
    : enRoll === 1 ? (usePlace ? `${artCap(A.g)} ${A.pt} de ${PL.ro}` : `${artCap(A.g)} ${A.pt} ${deOf(Bn.g)} ${Bn.pt}`)
    : enRoll === 2 ? (usePlace ? `${PL.ro}: ${artCap(A.g)} ${A.pt}` : `${artCap(Bn.g)} ${Bn.pt}: ${artCap(A.g)} ${A.pt}`)
    : enRoll === 3 ? `O Retorno ${deOf(A.g)} ${A.pt}`
    : enRoll === 4 ? `${artCap(A.g)} ${A.pt} Que ${pt3(V.ptRoot)} ${prepOf(V.ptPrep, Bn.g) || `${artL(Bn.g)} `}${Bn.pt}`
    : enRoll === 5 ? `${artCap(A.g)} ${A.pt} em Ascensão`
    : (usePlace ? `${A.pt} de ${PL.ro}` : `${A.pt} ${deOf(Bn.g)} ${Bn.pt}`);
  const romaji = `${placeRo ?? Bn.ro}ui ${A.ro}`;
  const title = useRomaji ? romaji : en;
  const synonyms = [`"${pt}" (PT-BR)`];
  if (!useRomaji && r() < 0.4) synonyms.push(romaji);
  else {
    const abbr = abbreviate(title);
    if (abbr && r() < 0.3) synonyms.push(abbr);
  }
  return { title: clean(title), titleEn: clean(en), titleNative: native, synonyms };
}

// ---------- Títulos: China (manhua) ----------
const CN_TEMPLATES = 5;
function cnTitle(r: RNG): TitleSet {
  let A = T.ENT_CN[Math.floor(r() * T.ENT_CN.length)];
  let Bn = T.ENT_CN[Math.floor(r() * T.ENT_CN.length)];
  while (Bn.ja === A.ja) Bn = T.ENT_CN[Math.floor(r() * T.ENT_CN.length)];
  const usePinyin = r() < 0.4;
  const native = `${Bn.ja}${A.ja}`;
  const enRoll = Math.floor(r() * CN_TEMPLATES);
  const en =
    enRoll === 0 ? `The ${A.en} of the ${Bn.en}`
    : enRoll === 1 ? `${Bn.en} ${A.en}`
    : enRoll === 2 ? `The ${Bn.en}'s ${A.en}`
    : enRoll === 3 ? `${A.en}: Path of the ${Bn.en}`
    : `Rise of the ${Bn.en} ${A.en}`;
  const pt =
    enRoll === 0 ? `${artCap(A.g)} ${A.pt} ${deOf(Bn.g)} ${Bn.pt}`
    : enRoll === 1 ? `${Bn.pt} e ${artL(A.g)} ${A.pt}`
    : enRoll === 2 ? `${artCap(A.g)} ${A.pt} ${deOf(Bn.g)} ${Bn.pt}`
    : enRoll === 3 ? `${A.pt}: ${artL(Bn.g) === "a" ? "a" : "o"} Caminho ${deOf(Bn.g)} ${Bn.pt}`
    : `A Ascensão ${deOf(Bn.g)} ${Bn.pt} e ${deOf(A.g)} ${A.pt}`;
  const pinyin = `${Bn.ro} ${A.ro}`;
  const title = usePinyin ? pinyin : en;
  const synonyms = [`"${pt}" (PT-BR)`];
  if (!usePinyin) synonyms.push(pinyin);
  return { title: clean(title), titleEn: clean(en), titleNative: native, synonyms };
}

// ---------- Autores ----------
function makeAuthors(r: RNG, country: string, isLightnovel: boolean) {
  const out: { name: string; role: string }[] = [];
  const pick = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  if (country === "JP") {
    const name = `${pick(T.FAMILY_JP).ro} ${pick(T.NAMES_JP).ro}`;
    out.push({ name, role: isLightnovel ? "História original" : "História & Arte" });
    if (!isLightnovel && r() < 0.4) out.push({ name: `${pick(T.FAMILY_JP).ro} ${pick(T.NAMES_JP).ro}`, role: "Arte" });
  } else if (country === "KR") {
    out.push({ name: `${pick(B.FAMILY_KR)} ${pick(B.NAMES_KR)}`, role: "História & Arte" });
    if (r() < 0.5) out.push({ name: `${pick(B.FAMILY_KR)} ${pick(B.NAMES_KR)}`, role: "História original" });
  } else {
    out.push({ name: `${pick(["Chen", "Wang", "Li", "Zhang", "Liu", "Yang", "Huang", "Wu", "Xu", "Sun"])} ${pick(["Wei", "Jun", "Xiao", "Ming", "Hua", "Lei", "Feng", "Yun"])}`, role: "História & Arte" });
  }
  return out;
}

// ---------- Links ----------
function makeLinks(title: string, type: string) {
  const q = encodeURIComponent(title);
  const links = [
    { site: "MyAnimeList", url: `https://myanimelist.net/search/all?q=${q}`, type: "info", color: "#2e51a2" },
    { site: "AniList", url: `https://anilist.co/search/${type === "anime" ? "anime" : "manga"}?search=${q}`, type: "info", color: "#02a9ff" },
    { site: "Twitter/X", url: `https://x.com/search?q=${q}`, type: "social", color: "#1d9bf0" },
    { site: "Google Notícias", url: `https://news.google.com/search?q=${q}&hl=pt-BR`, type: "news", color: "#4285f4" },
  ];
  if (type === "manga") links.push({ site: "MangaDex", url: `https://mangadex.org/search?q=${q}`, type: "leitura", color: "#ff6740" });
  if (type === "manhwa") links.push({ site: "Webtoon", url: `https://www.webtoons.com/en/search?keyword=${q}`, type: "leitura", color: "#00d564" });
  if (type === "manhwa") links.push({ site: "Lezhin Comics", url: `https://www.lezhinus.com/en/search?q=${q}`, type: "leitura", color: "#e52528" });
  if (type === "lightnovel") links.push({ site: "Amazon BR", url: `https://www.amazon.com.br/s?k=${q}&i=stripbooks`, type: "compra", color: "#ff9900" });
  if (type === "anime") links.push({ site: "Crunchyroll", url: `https://www.crunchyroll.com/pt-br/search?q=${q}`, type: "streaming", color: "#f47521" });
  if (type === "anime") links.push({ site: "LiveChart", url: `https://www.livechart.me/search?q=${q}`, type: "info", color: "#7b5cff" });
  return links;
}

// ---------- Capas AI (banco public/covers) ----------
const ALL_COVERS = [
  "c-fantasy-01", "c-fantasy-02", "c-villainess-01", "c-villainess-02",
  "c-action-01", "c-action-02", "c-cultivation-01", "c-cultivation-02",
  "c-school-01", "c-school-02", "c-office-01", "c-slice-01", "c-slice-02",
  "c-sports-01", "c-idol-01", "c-horror-01", "c-thriller-01", "c-mecha-01",
  "c-cyberpunk-01", "c-space-01", "c-yaoi-01", "c-yuri-01", "c-vampire-01",
  "c-yokai-01", "c-ecchi-01", "c-ecchi-02", "c-historical-01", "c-isekai-01",
  "c-dungeon-02", "c-academy-01", "c-hero-01", "c-revenge-01",
];

const THEME_COVER: Record<string, string[]> = {
  "isekai-villainess": ["c-villainess-01", "c-villainess-02", "c-revenge-01"],
  "isekai-slow": ["c-fantasy-01", "c-isekai-01"],
  dungeon: ["c-action-01", "c-dungeon-02"],
  cultivation: ["c-cultivation-01", "c-cultivation-02"],
  martial: ["c-action-02", "c-historical-01"],
  "school-romance": ["c-school-01", "c-school-02", "c-office-01"],
  "office-romance": ["c-office-01", "c-school-02"],
  sports: ["c-sports-01"],
  idol: ["c-idol-01"],
  gourmet: ["c-slice-01"],
  "dark-fantasy": ["c-action-01", "c-dungeon-02", "c-fantasy-02"],
  horror: ["c-horror-01"],
  mystery: ["c-thriller-01"],
  "psy-thriller": ["c-thriller-01"],
  mecha: ["c-mecha-01"],
  cyberpunk: ["c-cyberpunk-01"],
  space: ["c-space-01"],
  slice: ["c-slice-02", "c-slice-01"],
  "otome-har": ["c-villainess-01", "c-villainess-02"],
  harem: ["c-ecchi-01", "c-ecchi-02"],
  yaoi: ["c-yaoi-01"],
  yuri: ["c-yuri-01", "c-school-02"],
  historical: ["c-historical-01", "c-cultivation-02"],
  military: ["c-mecha-01", "c-historical-01"],
  zombie: ["c-horror-01"],
  "magic-academy": ["c-academy-01", "c-fantasy-01"],
  tamer: ["c-isekai-01", "c-fantasy-01"],
  merchant: ["c-fantasy-02", "c-isekai-01"],
  revenge: ["c-revenge-01", "c-action-02"],
  vrmmo: ["c-cyberpunk-01", "c-space-01"],
  "urban-supernatural": ["c-yokai-01"],
  vampire: ["c-vampire-01"],
  "demon-lord": ["c-fantasy-02"],
  "hero-party": ["c-hero-01", "c-fantasy-01"],
  noble: ["c-villainess-02", "c-revenge-01"],
};

const BANNER_FAM: { keys: string[]; files: string[] }[] = [
  { keys: ["isekai-slow", "magic-academy", "tamer", "demon-lord", "hero-party", "merchant", "noble", "otome-har", "isekai-villainess"], files: ["b-01"] },
  { keys: ["cyberpunk", "vrmmo", "space", "mecha"], files: ["b-02", "b-06"] },
  { keys: ["school-romance", "slice", "gourmet", "office-romance", "idol", "sports"], files: ["b-03", "b-05"] },
  { keys: ["dark-fantasy", "dungeon", "revenge", "horror", "zombie", "military", "historical", "martial", "cultivation"], files: ["b-04", "b-08"] },
  { keys: ["harem", "yaoi", "yuri", "vampire"], files: ["b-07"] },
];

function pickBanner(r: RNG, themeKey: string, spicy: number): string | null {
  if (spicy === 2) return null;
  if (r() >= 0.12) return null;
  const fam = BANNER_FAM.find((f) => f.keys.includes(themeKey));
  const files = fam?.files ?? ["b-01"];
  return `/covers/${files[Math.floor(r() * files.length)]}.jpg`;
}

// ---------- Revistas ----------
function pickMagazine(r: RNG, type: string, country: string, themeKey: string, spicy: number): string | null {
  if (spicy === 2) {
    const adult = MAGAZINES.filter((m) => {
      if (!m.adult || m.country !== country) return false;
      if (type === "anime") return false;
      if (type === "manhwa" || type === "manhua") return m.kind === "plataforma webtoon";
      return m.kind.startsWith("revista") || m.kind === "selo de light novel";
    });
    return adult.length ? adult[Math.floor(r() * adult.length)].key : null;
  }
  const pools = MAGAZINES.filter((m) => {
    if (m.adult) return false;
    if (type === "lightnovel") return m.country === country && m.kind === "selo de light novel";
    if (type === "manhwa" || type === "manhua") return m.country === country && m.kind === "plataforma webtoon";
    if (type === "anime") return m.country === country && m.kind.startsWith("revista");
    return m.country === country && m.kind.startsWith("revista");
  });
  if (!pools.length) return null;
  const themed = pools.filter((m) => m.themes?.includes(themeKey));
  if (themed.length && r() < 0.65) return themed[Math.floor(r() * themed.length)].key;
  if (type === "anime" && r() < 0.18) return null; // fonte original (sem revista)
  return pools[Math.floor(r() * pools.length)].key;
}

// ---------- Config por tipo ----------
const CONFIG: Record<string, { count: number; country: string; spicy1: number; spicy2: number; relRecent: number }> = {
  manga: { count: 10000, country: "JP", spicy1: 0.16, spicy2: 0.07, relRecent: 0.42 },
  manhwa: { count: 6000, country: "KR", spicy1: 0.14, spicy2: 0.06, relRecent: 0.46 },
  manhua: { count: 2500, country: "CN", spicy1: 0.08, spicy2: 0.03, relRecent: 0.44 },
  lightnovel: { count: 4000, country: "JP", spicy1: 0.12, spicy2: 0.04, relRecent: 0.40 },
  anime: { count: 1500, country: "JP", spicy1: 0.08, spicy2: 0.02, relRecent: 0.5 },
};

const NOW = Date.now();
const DAY = 86400000;

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

// ---------- Linha da obra (100% determinística por idx) ----------
export function makeRow(idx: number, type: string, attempt: number): any {
  const cfg = CONFIG[type];
  const r = mulberry32((hashInt(`${type}:${idx}:v4:${attempt}`) ^ 0x9e3779b9) >>> 0);
  const ri = (a: number, b: number) => Math.floor(r() * (b - a + 1)) + a;
  const pickR = <T,>(arr: T[]): T => arr[Math.floor(r() * arr.length)];
  const chanceR = (p: number) => r() < p;

  const theme = pickR(B.THEMES);
  const roles = theme.roles;
  const female = roles ? roles[0] === "f" : chanceR(0.45);

  const tset =
    cfg.country === "JP" ? jpTitle(r, type) : cfg.country === "KR" ? krTitle(r) : cnTitle(r);
  const title = tset.title;
  const titleEn = tset.titleEn;
  const titleNative = tset.titleNative;

  // picância
  let spicy = 0;
  const rr = r();
  if (rr < cfg.spicy2) spicy = 2;
  else if (rr < cfg.spicy2 + cfg.spicy1) spicy = 1;

  // datas
  const isHot = chanceR(0.045);
  const recent = isHot || chanceR(cfg.relRecent);
  let start: Date;
  if (recent) {
    start = new Date(NOW - ri(5, 600) * DAY);
  } else {
    start = new Date(ri(1998, 2024), ri(0, 11), ri(1, 28));
  }
  const ageDays = (NOW - start.getTime()) / DAY;
  let status: string;
  if (start.getTime() > NOW - 10 * DAY) status = chanceR(0.8) ? "RELEASING" : "NOT_YET_RELEASED";
  else if (ageDays < 240) status = chanceR(0.72) ? "RELEASING" : chanceR(0.5) ? "HIATUS" : "FINISHED";
  else status = chanceR(0.72) ? "FINISHED" : chanceR(0.6) ? "RELEASING" : chanceR(0.75) ? "HIATUS" : "CANCELLED";

  // capítulos
  let chapters: number | null = null;
  let volumes: number | null = null;
  let episodes: number | null = null;
  if (isHot) {
    chapters = ri(1, 5);
    status = "RELEASING";
    volumes = Math.max(1, Math.ceil(chapters / 8));
  } else if (type === "manga") {
    chapters = status === "RELEASING" ? ri(8, 420) : ri(12, 900);
    volumes = Math.max(1, Math.round(chapters / ri(8, 11)));
  } else if (type === "manhwa") {
    chapters = status === "RELEASING" ? ri(10, 140) : ri(20, 220);
    volumes = null;
  } else if (type === "manhua") {
    chapters = ri(30, 700);
    volumes = null;
  } else if (type === "lightnovel") {
    volumes = ri(2, 18);
    chapters = volumes * ri(5, 11);
  } else {
    episodes = chanceR(0.6) ? pickR([12, 13, 24, 25]) : pickR([11, 10, 26, 50, 8]);
    chapters = null;
  }

  // notas & popularidade
  const popBase = Math.pow(10, 2.4 + 3.4 * Math.pow(r(), 2.1));
  const popularity = Math.round(Math.min(popBase, 1_500_000));
  const avgScore = Math.min(95, Math.max(45, Math.round(56 + 37 * Math.pow(r(), 0.85) * (popularity > 200000 ? 1.05 : 0.95))));
  const favourites = Math.round(popularity * (0.004 + r() * 0.03));

  // lastUpdate p/ RELEASING → alimenta calendário semanal
  let lastUpdate: number | null = null;
  let nextEpisodeAt: string | null = null;
  let nextEpisodeNum: number | null = null;
  if (status === "RELEASING") {
    if (type === "anime") {
      nextEpisodeAt = new Date(NOW + (2 + r() * 6.5) * DAY).toISOString();
      episodes = ri(3, 11);
      nextEpisodeNum = episodes + 1;
    } else {
      lastUpdate = Math.floor((NOW - r() * 6.6 * DAY) / 1000);
    }
  }

  // tags
  const tags: { name: string; rank: number }[] = [];
  const push = (name: string, rank: number) => {
    if (!tags.some((t) => t.name === name)) tags.push({ name, rank });
  };
  theme.tags.forEach((t, i) => push(t, Math.max(55, 95 - i * 8 - ri(0, 10))));
  for (const g of theme.genres) push(g, 90);
  for (let i = 0; i < ri(2, 5); i++) push(pickR(B.EXTRA_TAGS), ri(30, 70));
  if (spicy === 1) {
    push("Ecchi", ri(75, 96));
    push(pickR(B.ECCHI_TAGS), ri(45, 80));
  }
  if (spicy === 2) {
    push("Hentai", ri(85, 99));
    push("+18", 99);
    push(pickR(["Explícito", "Conteúdo Adulto"]), ri(60, 90));
  }
  if (type === "manhwa") push("Long Strip", ri(80, 95));
  if (female) push("Protagonista Feminina", ri(60, 90));

  const genres = [...new Set([...theme.genres, ...(spicy >= 1 ? ["Ecchi"] : [])])];

  const authors = makeAuthors(r, cfg.country, type === "lightnovel");
  const links = makeLinks(title, type);
  const magazine = pickMagazine(r, type, cfg.country, theme.key, spicy);

  const cover = spicy === 2 ? "" : `/covers/${(THEME_COVER[theme.key] ?? ALL_COVERS)[Math.floor(r() * (THEME_COVER[theme.key] ?? ALL_COVERS).length)]}.jpg`;
  const banner = pickBanner(r, theme.key, spicy);

  const row = {
    id: `g${String(idx).padStart(6, "0")}`,
    malId: null,
    type,
    format: type === "lightnovel" ? "NOVEL" : type === "anime" ? "TV" : "MANGA",
    title,
    titleEn,
    titleNative,
    synonyms: JSON.stringify(tset.synonyms),
    synopsis: null as string | null,
    synopsisPT: null as string | null,
    cover,
    coverColor: null as string | null,
    banner,
    status,
    chapters,
    volumes,
    episodes,
    duration: type === "anime" ? pickR([23, 24, 4, 14, 8]) : null,
    startDate: isoDate(start),
    endDate: status === "FINISHED" ? isoDate(new Date(start.getTime() + ri(60, 900) * DAY)) : null,
    country: cfg.country,
    isAdult: spicy === 2,
    spicy,
    genres: JSON.stringify(genres),
    tags: JSON.stringify(tags),
    avgScore,
    popularity,
    favourites,
    authors: JSON.stringify(authors),
    extLinks: JSON.stringify(links),
    magazine,
    source: pickR(["ORIGINAL", "LIGHT_NOVEL", "WEB_NOVEL", "MANGA", "GAME", "4-KOMA MANGA"]),
    siteUrl: null as string | null,
    lastUpdate,
    nextEpisodeAt,
    nextEpisodeNum,
  };

  const syn = buildSynopsis({
    id: row.id, type, country: cfg.country, genresJson: row.genres,
    spicy, status, chapters, volumes, episodes,
  });
  row.synopsis = syn;
  row.synopsisPT = syn;
  const hue = hashInt(row.id) % 360;
  row.coverColor = hslToHex(hue, 68, 44);
  row.siteUrl = `https://anilist.co/search/${type === "anime" ? "anime" : "manga"}?search=${encodeURIComponent(title)}`;

  return row;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to255 = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `#${to255(f(0))}${to255(f(8))}${to255(f(4))}`;
}

async function main() {
  const t0 = Date.now();
  const del = await db.work.deleteMany({ where: { id: { startsWith: "g" } } });
  console.log(`Removidos ${del.count} gerados anteriores`);

  const total = Object.values(CONFIG).reduce((a, c) => a + c.count, 0);
  console.log(`Gerando ${total} obras (v4 — títulos originais + revistas + capas AI)...`);

  let idx = 1;
  const seen = new Set<string>();
  let dupes = 0;
  let withCover = 0;

  for (const [type, cfg] of Object.entries(CONFIG)) {
    let made = 0;
    let batch: any[] = [];
    while (made < cfg.count) {
      let attempt = 0;
      let row = makeRow(idx, type, attempt);
      while (seen.has(row.title) && attempt < 40) {
        dupes++;
        row = makeRow(idx, type, ++attempt);
      }
      if (seen.has(row.title)) {
        // garantia de unicidade: sufixo determinístico baseado no idx
        const roman = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
        let suffix = roman[idx % 10];
        if (seen.has(`${row.title} ${suffix}`)) suffix = String(idx);
        row = { ...row, title: `${row.title} ${suffix}` };
        dupes++;
      }
      seen.add(row.title);
      if (row.cover) withCover++;
      idx++;
      made++;
      batch.push(row);
      if (batch.length >= 2000) {
        const bt = Date.now();
        await db.work.createMany({ data: batch });
        if (process.env.PROFILE_GEN === "1") console.log(`    batch ${type} ${made}: gen+ins ${Date.now() - bt}ms (batch de ${batch.length})`);
        batch = [];
      }
    }
    if (batch.length) await db.work.createMany({ data: batch });
    console.log(`  ${type}: ${made} ok`);
  }

  const t1 = Date.now();
  const totalDb = await db.work.count();
  const adult = await db.work.count({ where: { isAdult: true } });
  const ecchi = await db.work.count({ where: { spicy: 1 } });
  const hot = await db.work.count({ where: { chapters: { lte: 5 }, type: { in: ["manga", "manhwa"] } } });
  const withMag = await db.work.count({ where: { magazine: { not: null } } });
  console.log(`Concluído em ${((t1 - t0) / 1000).toFixed(1)}s — total no banco: ${totalDb}`);
  console.log(`Adultos (+18): ${adult} · Ecchi: ${ecchi} · Novos ≤5 caps: ${hot}`);
  console.log(`Com capa AI: ${withCover} · Com revista: ${withMag} · Duplicatas descartadas: ${dupes}`);
  await db.$disconnect();
}

if (process.env.NO_MAIN !== "1") {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
