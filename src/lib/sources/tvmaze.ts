// Fonte REAL: TVMaze API (https://api.tvmaze.com) — doramas ASIÁTICOS reais
// (coreanos, japoneses, chineses, tailandeses) com imagens reais de produção,
// emissoras reais (tvN, JTBC, Netflix...) e datas de episódios reais.

import { MD_UA } from "./mangadex";
import { brokerFetch } from "../broker";

const TVMAZE = "https://api.tvmaze.com";

/** Passa pelo BROKER (fila própria + retry + breaker). Retorna null quando a fonte cai. */
export async function tvFetch(path: string): Promise<any> {
  const r = await brokerFetch("tvmaze", `${TVMAZE}${path}`, {
    headers: { "User-Agent": MD_UA, Accept: "application/json" },
    timeoutMs: 20_000,
  });
  if (!r.data || !r.data.ok) return null;
  try {
    return await r.data.json();
  } catch {
    return null;
  }
}

/** Doramas asiáticos famosos e reais — usado como lista de sementes para
 *  resolver metadados + imagens reais na TVMaze. */
export const CURATED_DRAMAS: { name: string; country: string }[] = [
  // ===== Coreia do Sul =====
  { name: "Squid Game", country: "KR" },
  { name: "Goblin", country: "KR" },
  { name: "Descendants of the Sun", country: "KR" },
  { name: "Crash Landing on You", country: "KR" },
  { name: "Itaewon Class", country: "KR" },
  { name: "Vincenzo", country: "KR" },
  { name: "Hometown Cha-Cha-Cha", country: "KR" },
  { name: "Twenty-Five Twenty-One", country: "KR" },
  { name: "Extraordinary Attorney Woo", country: "KR" },
  { name: "Alchemy of Souls", country: "KR" },
  { name: "Mr. Sunshine", country: "KR" },
  { name: "Signal", country: "KR" },
  { name: "Reply 1988", country: "KR" },
  { name: "Hospital Playlist", country: "KR" },
  { name: "My Mister", country: "KR" },
  { name: "Sky Castle", country: "KR" },
  { name: "Stranger", country: "KR" },
  { name: "Flower of Evil", country: "KR" },
  { name: "True Beauty", country: "KR" },
  { name: "Business Proposal", country: "KR" },
  { name: "My Liberation Notes", country: "KR" },
  { name: "Our Blues", country: "KR" },
  { name: "Little Women", country: "KR" },
  { name: "The Glory", country: "KR" },
  { name: "Queen of Tears", country: "KR" },
  { name: "Lovely Runner", country: "KR" },
  { name: "Marry My Husband", country: "KR" },
  { name: "Doctor Slump", country: "KR" },
  { name: "Twinkling Watermelon", country: "KR" },
  { name: "My Demon", country: "KR" },
  { name: "Gyeongseong Creature", country: "KR" },
  { name: "Boys Over Flowers", country: "KR" },
  { name: "The Heirs", country: "KR" },
  { name: "My Love from the Star", country: "KR" },
  { name: "Kill Me, Heal Me", country: "KR" },
  { name: "What's Wrong with Secretary Kim", country: "KR" },
  { name: "While You Were Sleeping", country: "KR" },
  { name: "Weightlifting Fairy Kim Bok-joo", country: "KR" },
  { name: "Moon Lovers: Scarlet Heart Ryeo", country: "KR" },
  { name: "Hotel Del Luna", country: "KR" },
  { name: "It's Okay to Not Be Okay", country: "KR" },
  { name: "Start-Up", country: "KR" },
  { name: "Taxi Driver", country: "KR" },
  { name: "Bad and Crazy", country: "KR" },
  { name: "Reborn Rich", country: "KR" },
  { name: "The Uncanny Counter", country: "KR" },
  { name: "Sweet Home", country: "KR" },
  { name: "All of Us Are Dead", country: "KR" },
  { name: "D.P.", country: "KR" },
  { name: "Mine", country: "KR" },
  { name: "Beyond Evil", country: "KR" },
  { name: "Secret Garden", country: "KR" },
  { name: "City Hunter", country: "KR" },
  { name: "Healer", country: "KR" },
  { name: "Pinocchio", country: "KR" },
  { name: "W: Two Worlds", country: "KR" },
  { name: "Suspicious Partner", country: "KR" },
  { name: "Because This Is My First Life", country: "KR" },
  { name: "Search: WWW", country: "KR" },
  { name: "Romance Is a Bonus Book", country: "KR" },
  { name: "Encounter", country: "KR" },
  { name: "Mr. Queen", country: "KR" },
  { name: "The Red Sleeve", country: "KR" },
  { name: "Doom at Your Service", country: "KR" },
  { name: "Nevertheless", country: "KR" },
  { name: "Dali and Cocky Prince", country: "KR" },
  { name: "Forecasting Love and Weather", country: "KR" },
  { name: "Military Prosecutor Doberman", country: "KR" },
  { name: "Big Mouth", country: "KR" },
  { name: "One Dollar Lawyer", country: "KR" },
  { name: "The Golden Spoon", country: "KR" },
  { name: "Agency", country: "KR" },
  { name: "Taxi Driver Season 2", country: "KR" },
  { name: "King the Land", country: "KR" },
  { name: "See You in My 19th Life", country: "KR" },
  { name: "My Lovely Liar", country: "KR" },
  { name: "Arthdal Chronicles", country: "KR" },
  { name: "Mr. Robot", country: "KR" },
  { name: "Uncontrollably Fond", country: "KR" },
  { name: "Legend of the Blue Sea", country: "KR" },
  { name: "Strong Woman Do Bong-soon", country: "KR" },
  { name: "Fight for My Way", country: "KR" },
  { name: "Chief Kim", country: "KR" },
  { name: "Six Flying Dragons", country: "KR" },
  { name: "Tree with Deep Roots", country: "KR" },
  { name: "My Dearest Nemesis", country: "KR" },
  { name: "When the Phone Rings", country: "KR" },
  { name: "Study Group", country: "KR" },
  { name: "Weak Hero Class 1", country: "KR" },
  // ===== Japão =====
  { name: "Alice in Borderland", country: "JP" },
  { name: "Yu Yu Hakusho", country: "JP" },
  { name: "One Piece", country: "JP" },
  { name: "Hana Yori Dango", country: "JP" },
  { name: "Great Teacher Onizuka", country: "JP" },
  { name: "Nodame Cantabile", country: "JP" },
  { name: "1 Litre of Tears", country: "JP" },
  { name: "Midnight Diner", country: "JP" },
  { name: "Erased", country: "JP" },
  { name: "The Good Doctor", country: "JP" },
  { name: "First Love", country: "JP" },
  { name: "Shogun", country: "JP" },
  { name: "House of Ninjas", country: "JP" },
  { name: "GTO: Great Teacher Onizuka (2012)", country: "JP" },
  { name: "Long Vacation", country: "JP" },
  { name: "Nana", country: "JP" },
  { name: "Death Note", country: "JP" },
  { name: "Liar Game", country: "JP" },
  { name: "Rookies", country: "JP" },
  { name: "Hanzawa Naoki", country: "JP" },
  { name: "Legal High", country: "JP" },
  { name: "Unnatural", country: "JP" },
  { name: "Kimi wa Petto", country: "JP" },
  { name: "Coffee & Vanilla", country: "JP" },
  { name: "Sailor Moon", country: "JP" },
  { name: "From Today, It's My Turn!!", country: "JP" },
  { name: "Kingdom", country: "JP" },
  { name: "Silent", country: "JP" },
  { name: "Jump (2004)", country: "JP" },
  { name: "Sakamoto Days", country: "JP" },
  // ===== China =====
  { name: "The Untamed", country: "CN" },
  { name: "Eternal Love", country: "CN" },
  { name: "Love O2O", country: "CN" },
  { name: "Go Go Squid!", country: "CN" },
  { name: "Ashes of Love", country: "CN" },
  { name: "Story of Yanxi Palace", country: "CN" },
  { name: "Joy of Life", country: "CN" },
  { name: "Word of Honor", country: "CN" },
  { name: "Meteor Garden", country: "CN" },
  { name: "Put Your Head on My Shoulder", country: "CN" },
  { name: "The Romance of Tiger and Rose", country: "CN" },
  { name: "Hidden Love", country: "CN" },
  { name: "Love Between Fairy and Devil", country: "CN" },
  { name: "Till the End of the Moon", country: "CN" },
  { name: "Lost You Forever", country: "CN" },
  { name: "My Fair Lady", country: "CN" },
  { name: "The Double", country: "CN" },
  { name: "Empresses in the Palace", country: "CN" },
  { name: "Nirvana in Fire", country: "CN" },
  { name: "The Long Ballad", country: "CN" },
  { name: "Shining For One Thing", country: "CN" },
  { name: "My Journey to You", country: "CN" },
  { name: "Fangs of Fortune", country: "CN" },
  { name: "You Are My Glory", country: "CN" },
  { name: "Falling Into Your Smile", country: "CN" },
  { name: "The Blood of Youth", country: "CN" },
  { name: "Sword and Fairy 4", country: "CN" },
  { name: "Love Is Sweet", country: "CN" },
  // ===== Tailândia =====
  { name: "2gether", country: "TH" },
  { name: "TharnType", country: "TH" },
  { name: "Bad Buddy", country: "TH" },
  { name: "KinnPorsche", country: "TH" },
  { name: "The Sign", country: "TH" },
  { name: "Only Friends", country: "TH" },
  { name: "Girl From Nowhere", country: "TH" },
  { name: "F4 Thailand", country: "TH" },
  { name: "My School President", country: "TH" },
  { name: "Last Twilight", country: "TH" },
];

const TV_STATUS_MAP: Record<string, string> = {
  Running: "RELEASING",
  "Returning Series": "RELEASING",
  Ended: "FINISHED",
  Canceled: "CANCELLED",
  "To Be Determined": "HIATUS",
  "In Development": "NOT_YET_RELEASED",
  "Pilot Ordered": "NOT_YET_RELEASED",
  Upcoming: "NOT_YET_RELEASED",
  "New Series": "RELEASING",
  "Final Season": "RELEASING",
  "On Hiatus": "HIATUS",
};

const LANG_CODE: Record<string, string> = {
  Korean: "ko",
  Japanese: "ja",
  Mandarin: "zh",
  Chinese: "zh",
  Cantonese: "zh",
  Thai: "th",
  English: "en",
};

export interface TvShow {
  id: number;
  name: string;
  type: string;
  language: string;
  genres: string[];
  status: string;
  runtime: number | null;
  averageRuntime: number | null;
  premiered: string | null;
  ended: string | null;
  officialSite: string | null;
  schedule?: any;
  rating?: { average: number | null };
  weight?: number;
  network?: { name: string; officialSite?: string | null } | null;
  webChannel?: { name: string; officialSite?: string | null } | null;
  image?: { original?: string; medium?: string } | null;
  summary?: string | null;
  url: string;
  _embedded?: { nextepisode?: { airstamp?: string; airdate?: string; number?: number; name?: string } };
}

/** Busca o show mais provável pelo nome + confere país pelo idioma quando possível */
export async function tvSearchShow(q: string, country: string): Promise<TvShow | null> {
  const data = await tvFetch(`/search/shows?q=${encodeURIComponent(q)}&embed=nextepisode`);
  if (!Array.isArray(data) || !data.length) return null;
  const wantLang = { KR: "Korean", JP: "Japanese", CN: "Mandarin", TH: "Thai" }[country];
  const candidates: TvShow[] = data.map((d: any) => d.show).filter(Boolean);
  // prioridade: idioma do país + tipo Scripted + tem imagem
  const scored = candidates.map((s) => {
    let score = 0;
    if (wantLang && s.language === wantLang) score += 10;
    if (s.language && country !== "KR" && s.language !== "English") score += 4;
    if (s.type === "Scripted") score += 3;
    if (s.image) score += 2;
    if (s.name.toLowerCase() === q.toLowerCase()) score += 5;
    if (s.weight) score += s.weight / 50;
    return { s, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0]?.s;
  return best ?? null;
}

/** Converte show TVMaze em linha Prisma (id tv-<id>) — dorama REAL */
export function tvToWorkRow(s: TvShow, country: string) {
  const summary = (s.summary ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1200) || null;

  const network = s.network?.name ?? s.webChannel?.name ?? null;
  const platform = s.webChannel?.name ?? s.network?.name ?? null;
  const extLinks: { site: string; url: string; type: string }[] = [
    { site: "TVMaze", url: s.url, type: "INFO" },
  ];
  if (s.officialSite) extLinks.push({ site: "Site oficial", url: s.officialSite, type: "OFFICIAL" });

  const next = s._embedded?.nextepisode;
  const nextAt = next?.airstamp ?? null;
  const langCode = LANG_CODE[s.language] ?? null;

  return {
    id: `tv-${s.id}`,
    malId: null,
    type: "drama",
    format: "TV",
    title: s.name,
    titleEn: null,
    titleNative: null,
    synonyms: JSON.stringify([]),
    synopsis: summary,
    cover: s.image?.original ?? s.image?.medium ?? "",
    coverAlts: s.image?.medium && s.image?.original ? JSON.stringify([s.image.medium]) : null,
    coverColor: null,
    banner: null,
    status: TV_STATUS_MAP[s.status] ?? "FINISHED",
    chapters: null,
    volumes: null,
    episodes: null,
    duration: s.averageRuntime ?? s.runtime ?? null,
    startDate: s.premiered ?? null,
    endDate: s.ended ?? null,
    country,
    isAdult: false,
    spicy: 0,
    genres: JSON.stringify(s.genres ?? []),
    tags: JSON.stringify([]),
    avgScore: s.rating?.average ? Math.round(s.rating.average * 10) : null,
    popularity: (s.weight ?? 0) * 300,
    favourites: null,
    authors: JSON.stringify([]),
    extLinks: JSON.stringify(extLinks),
    source: platform, // emissora/plataforma REAL (tvN, JTBC, Netflix, Viki...)
    siteUrl: s.url,
    magazine: null,
    serialization: network,
    langs: langCode ? JSON.stringify([langCode]) : null,
    follows: null,
    lastUpdate: null,
    nextEpisodeAt: nextAt,
    nextEpisodeNum: next?.number ?? null,
  };
}
