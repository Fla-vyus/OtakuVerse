// Dados reais de vendas de mangá — relatórios públicos da Oricon (rankings anuais
// de séries e de volumes individuais) + acumulados históricos divulgados por
// editoras/imprensa especializada. Números arredondados e aproximados, como publicados.
// As capas não são replicadas: cada entrada é casada com o catálogo real (AniList)
// e a capa vem do banco, via proxy anti-bloqueio. Nada é inventado por IA.

export interface SaleVolumeEntry {
  series: string; // nome canônico da série
  aliases?: string[];
  volume: number;
  year: number;
  copies: number; // cópias no ano (aprox., publicações Oricon)
}

export interface SaleSeriesEntry {
  series: string;
  aliases?: string[];
  year: number;
  copies: number;
}

export interface SaleAllTimeEntry {
  series: string;
  aliases?: string[];
  copies: number; // acumulado histórico (aprox., editoras/imprensa)
  note?: string;
}

// ---------- Séries mais vendidas do ano (Oricon, cópias do ano) ----------
export const SERIES_BY_YEAR: SaleSeriesEntry[] = [
  // 2024
  { series: "Jujutsu Kaisen", year: 2024, copies: 12_900_000 },
  { series: "One Piece", year: 2024, copies: 7_500_000 },
  { series: "Blue Lock", year: 2024, copies: 7_100_000 },
  { series: "Chainsaw Man", year: 2024, copies: 5_200_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], year: 2024, copies: 4_000_000 },
  { series: "Sakamoto Days", year: 2024, copies: 3_500_000 },
  { series: "Kaiju No. 8", aliases: ["Kaijuu 8-gou", "Kaiju No.8", "Monster #8"], year: 2024, copies: 3_200_000 },
  { series: "Witch Watch", year: 2024, copies: 2_600_000 },
  { series: "Dandadan", year: 2024, copies: 2_500_000 },
  { series: "Frieren: Beyond Journey's End", aliases: ["Sousou no Frieren"], year: 2024, copies: 2_400_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], year: 2024, copies: 2_200_000 },
  { series: "Haikyu!!", aliases: ["Haikyuu!!", "Haikyuu", "Haikyū!!"], year: 2024, copies: 1_900_000 },
  // 2023
  { series: "Blue Lock", year: 2023, copies: 10_800_000 },
  { series: "Jujutsu Kaisen", year: 2023, copies: 8_500_000 },
  { series: "One Piece", year: 2023, copies: 6_600_000 },
  { series: "Tokyo Revengers", year: 2023, copies: 5_200_000 },
  { series: "Chainsaw Man", year: 2023, copies: 4_700_000 },
  { series: "Kingdom", year: 2023, copies: 4_100_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], year: 2023, copies: 3_600_000 },
  { series: "SPY×FAMILY", aliases: ["Spy x Family", "Spy×Family"], year: 2023, copies: 3_300_000 },
  { series: "Haikyu!!", aliases: ["Haikyuu!!", "Haikyuu", "Haikyū!!"], year: 2023, copies: 3_000_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], year: 2023, copies: 2_700_000 },
  { series: "Oshi no Ko", year: 2023, copies: 2_300_000 },
  // 2022
  { series: "Tokyo Revengers", year: 2022, copies: 11_000_000 },
  { series: "Jujutsu Kaisen", year: 2022, copies: 9_400_000 },
  { series: "One Piece", year: 2022, copies: 9_200_000 },
  { series: "SPY×FAMILY", aliases: ["Spy x Family", "Spy×Family"], year: 2022, copies: 7_400_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], year: 2022, copies: 5_500_000 },
  { series: "Kingdom", year: 2022, copies: 4_600_000 },
  { series: "Blue Lock", year: 2022, copies: 4_400_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], year: 2022, copies: 3_600_000 },
  { series: "Chainsaw Man", year: 2022, copies: 3_200_000 },
  { series: "Golden Kamuy", year: 2022, copies: 2_500_000 },
  { series: "Attack on Titan", aliases: ["Shingeki no Kyojin"], year: 2022, copies: 2_300_000 },
  // 2021
  { series: "Jujutsu Kaisen", year: 2021, copies: 30_900_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], year: 2021, copies: 30_800_000 },
  { series: "One Piece", year: 2021, copies: 7_000_000 },
  { series: "Tokyo Revengers", year: 2021, copies: 5_200_000 },
  { series: "Attack on Titan", aliases: ["Shingeki no Kyojin"], year: 2021, copies: 4_900_000 },
  { series: "Kingdom", year: 2021, copies: 4_400_000 },
  { series: "SPY×FAMILY", aliases: ["Spy x Family", "Spy×Family"], year: 2021, copies: 3_100_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], year: 2021, copies: 2_900_000 },
  { series: "Dr. Stone", year: 2021, copies: 2_400_000 },
  { series: "Haikyu!!", aliases: ["Haikyuu!!", "Haikyuu", "Haikyū!!"], year: 2021, copies: 2_200_000 },
  { series: "Chainsaw Man", year: 2021, copies: 2_000_000 },
  { series: "Golden Kamuy", year: 2021, copies: 1_800_000 },
];

// ---------- Volumes individuais mais vendidos do ano (Oricon) ----------
export const VOLUMES_BY_YEAR: SaleVolumeEntry[] = [
  // 2024
  { series: "Jujutsu Kaisen", volume: 25, year: 2024, copies: 1_740_000 },
  { series: "Jujutsu Kaisen", volume: 26, year: 2024, copies: 1_710_000 },
  { series: "Jujutsu Kaisen", volume: 27, year: 2024, copies: 1_690_000 },
  { series: "Blue Lock", volume: 28, year: 2024, copies: 1_550_000 },
  { series: "Blue Lock", volume: 27, year: 2024, copies: 1_520_000 },
  { series: "One Piece", volume: 108, year: 2024, copies: 1_420_000 },
  { series: "One Piece", volume: 107, year: 2024, copies: 1_400_000 },
  { series: "Blue Lock", volume: 29, year: 2024, copies: 1_350_000 },
  { series: "One Piece", volume: 109, year: 2024, copies: 950_000 },
  { series: "Chainsaw Man", volume: 16, year: 2024, copies: 1_100_000 },
  { series: "Sakamoto Days", volume: 17, year: 2024, copies: 950_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], volume: 40, year: 2024, copies: 900_000 },
  { series: "Kaiju No. 8", aliases: ["Kaijuu 8-gou", "Kaiju No.8", "Monster #8"], volume: 10, year: 2024, copies: 880_000 },
  { series: "Dandadan", volume: 16, year: 2024, copies: 800_000 },
  { series: "Frieren: Beyond Journey's End", aliases: ["Sousou no Frieren"], volume: 12, year: 2024, copies: 780_000 },
  // 2023
  { series: "Blue Lock", volume: 26, year: 2023, copies: 1_720_000 },
  { series: "Jujutsu Kaisen", volume: 23, year: 2023, copies: 1_400_000 },
  { series: "Jujutsu Kaisen", volume: 24, year: 2023, copies: 1_390_000 },
  { series: "Blue Lock", volume: 25, year: 2023, copies: 1_300_000 },
  { series: "Jujutsu Kaisen", volume: 22, year: 2023, copies: 1_250_000 },
  { series: "One Piece", volume: 106, year: 2023, copies: 1_200_000 },
  { series: "One Piece", volume: 105, year: 2023, copies: 1_150_000 },
  { series: "Tokyo Revengers", volume: 31, year: 2023, copies: 1_050_000 },
  { series: "Chainsaw Man", volume: 14, year: 2023, copies: 980_000 },
  { series: "Blue Lock", volume: 24, year: 2023, copies: 920_000 },
  { series: "Kingdom", volume: 65, year: 2023, copies: 850_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], volume: 37, year: 2023, copies: 800_000 },
  { series: "Oshi no Ko", volume: 10, year: 2023, copies: 760_000 },
  // 2022
  { series: "Jujutsu Kaisen", volume: 18, year: 2022, copies: 1_320_000 },
  { series: "One Piece", volume: 100, year: 2022, copies: 1_300_000 },
  { series: "Jujutsu Kaisen", volume: 19, year: 2022, copies: 1_250_000 },
  { series: "Tokyo Revengers", volume: 28, year: 2022, copies: 1_200_000 },
  { series: "One Piece", volume: 101, year: 2022, copies: 1_150_000 },
  { series: "Jujutsu Kaisen", volume: 17, year: 2022, copies: 1_100_000 },
  { series: "Tokyo Revengers", volume: 27, year: 2022, copies: 1_050_000 },
  { series: "SPY×FAMILY", aliases: ["Spy x Family", "Spy×Family"], volume: 9, year: 2022, copies: 1_000_000 },
  { series: "One Piece", volume: 99, year: 2022, copies: 950_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], volume: 22, year: 2022, copies: 900_000 },
  { series: "Kingdom", volume: 61, year: 2022, copies: 850_000 },
  { series: "Chainsaw Man", volume: 12, year: 2022, copies: 800_000 },
  // 2021
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], volume: 23, year: 2021, copies: 5_350_000 },
  { series: "Jujutsu Kaisen", volume: 15, year: 2021, copies: 3_050_000 },
  { series: "Jujutsu Kaisen", volume: 16, year: 2021, copies: 2_700_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], volume: 22, year: 2021, copies: 1_750_000 },
  { series: "Jujutsu Kaisen", volume: 14, year: 2021, copies: 1_600_000 },
  { series: "One Piece", volume: 99, year: 2021, copies: 1_550_000 },
  { series: "One Piece", volume: 98, year: 2021, copies: 1_500_000 },
  { series: "Attack on Titan", aliases: ["Shingeki no Kyojin"], volume: 34, year: 2021, copies: 1_300_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], volume: 21, year: 2021, copies: 1_200_000 },
  { series: "Kingdom", volume: 57, year: 2021, copies: 900_000 },
  { series: "My Hero Academia", aliases: ["Boku no Hero Academia"], volume: 29, year: 2021, copies: 850_000 },
  { series: "SPY×FAMILY", aliases: ["Spy x Family", "Spy×Family"], volume: 6, year: 2021, copies: 800_000 },
];

// ---------- Acumulados históricos (editoras/imprensa, aprox.) ----------
export const ALL_TIME: SaleAllTimeEntry[] = [
  { series: "One Piece", copies: 516_000_000, note: "recorde absoluto do mangá" },
  { series: "Golgo 13", copies: 300_000_000 },
  { series: "Detective Conan", aliases: ["Case Closed", "Meitantei Conan"], copies: 270_000_000 },
  { series: "Dragon Ball", copies: 260_000_000 },
  { series: "Naruto", copies: 250_000_000 },
  { series: "Demon Slayer: Kimetsu no Yaiba", aliases: ["Kimetsu no Yaiba", "Demon Slayer"], copies: 220_000_000, note: "explosão 2020–21" },
  { series: "Slam Dunk", copies: 185_000_000 },
  { series: "Attack on Titan", aliases: ["Shingeki no Kyojin"], copies: 140_000_000 },
  { series: "Bleach", copies: 130_000_000 },
  { series: "JoJo's Bizarre Adventure", aliases: ["JoJo no Kimyou na Bouken"], copies: 120_000_000 },
  { series: "Kingdom", copies: 100_000_000 },
  { series: "Fist of the North Star", aliases: ["Hokuto no Ken"], copies: 100_000_000 },
  { series: "Hunter × Hunter", aliases: ["Hunter x Hunter", "HxH"], copies: 84_000_000 },
  { series: "Tokyo Revengers", copies: 70_000_000 },
  { series: "Captain Tsubasa", copies: 70_000_000 },
  { series: "Haikyu!!", aliases: ["Haikyuu!!", "Haikyuu", "Haikyū!!"], copies: 60_000_000 },
  { series: "Berserk", copies: 60_000_000 },
  { series: "Saint Seiya", aliases: ["Cavaleiros do Zodíaco"], copies: 50_000_000 },
  { series: "Vinland Saga", copies: 7_000_000 },
];

// ---------- Casamento de títulos com o catálogo real ----------
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[×✕✖]/g, "x")
    .replace(/[·–—:,'’!?.]/g, " ")
    .replace(/\b(the|a|no|na)\b/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MatchableWork {
  id: string;
  title: string;
  titleEn?: string | null;
  titleNative?: string | null;
  synonyms?: string[];
  cover: string;
  coverColor?: string | null;
  type: string;
}

/** Encontra a obra real do catálogo correspondente ao nome canônico (busca por título, aliases, nativo e sinônimos) */
export function matchWork(name: string, aliases: string[] | undefined, pool: MatchableWork[]): MatchableWork | null {
  const keys = [norm(name), ...(aliases ?? []).map(norm)].filter(Boolean);
  const keySet = new Set(keys);
  let best: { w: MatchableWork; score: number } | null = null;
  for (const w of pool) {
    const candidates = [w.title, w.titleEn ?? "", w.titleNative ?? "", ...(w.synonyms ?? [])].map(norm).filter(Boolean);
    let score = 0;
    for (const c of candidates) {
      if (keySet.has(c)) score = Math.max(score, 100);
      else if (keys.some((k) => k && (c.startsWith(k) || k.startsWith(c)))) score = Math.max(score, 60);
    }
    if (score > 0 && w.type === "manga") score += 5;
    if (score > (best?.score ?? 0)) best = { w, score };
  }
  return best && best.score >= 60 ? best.w : null;
}

export const SALES_YEARS = [...new Set(SERIES_BY_YEAR.map((s) => s.year))].sort((a, b) => b - a);
