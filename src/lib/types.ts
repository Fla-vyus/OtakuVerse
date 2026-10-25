// Tipos compartilhados entre servidor e cliente
export type WorkType = "manga" | "manhwa" | "manhua" | "lightnovel" | "anime";

export interface TagRef {
  name: string;
  rank: number;
}

export interface AuthorRef {
  name: string;
  role: string;
}

export interface ExtLink {
  site: string;
  url: string;
  language?: string | null;
  type?: string | null;
  color?: string | null;
  icon?: string | null;
}

export interface WorkData {
  id: string;
  malId?: number | null;
  type: WorkType;
  format?: string | null;
  title: string;
  titleEn?: string | null;
  titleNative?: string | null;
  synonyms?: string[];
  synopsis?: string | null;
  synopsisPT?: string | null;
  cover: string;
  coverColor?: string | null;
  banner?: string | null;
  status?: string | null;
  chapters?: number | null;
  volumes?: number | null;
  episodes?: number | null;
  duration?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  country?: string | null;
  isAdult: boolean;
  genres: string[];
  tags: TagRef[];
  avgScore?: number | null;
  popularity?: number | null;
  favourites?: number | null;
  authors: AuthorRef[];
  extLinks: ExtLink[];
  source?: string | null;
  siteUrl?: string | null;
  lastUpdate?: number | null;
  nextEpisodeAt?: string | null;
  nextEpisodeNum?: number | null;
}

export const TYPE_LABEL: Record<WorkType, string> = {
  manga: "Mangá",
  manhwa: "Manhwa",
  manhua: "Manhua",
  lightnovel: "Light Novel",
  anime: "Anime",
};

export const STATUS_LABEL: Record<string, string> = {
  RELEASING: "Em lançamento",
  FINISHED: "Concluído",
  HIATUS: "Em hiato",
  NOT_YET_RELEASED: "Não lançado",
  CANCELLED: "Cancelado",
};

export const TYPE_COLORS: Record<WorkType, string> = {
  manga: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  manhwa: "bg-purple-500/15 text-purple-300 border-purple-500/30",
  manhua: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  lightnovel: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  anime: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

export function parseWork(raw: any): WorkData {
  const safeJson = (v: any, fb: any) => {
    try {
      return v ? JSON.parse(v) : fb;
    } catch {
      return fb;
    }
  };
  return {
    id: raw.id,
    malId: raw.malId ?? null,
    type: (raw.type ?? "manga") as WorkType,
    format: raw.format ?? null,
    title: raw.title,
    titleEn: raw.titleEn ?? null,
    titleNative: raw.titleNative ?? null,
    synonyms: safeJson(raw.synonyms, []),
    synopsis: raw.synopsis ?? null,
    synopsisPT: raw.synopsisPT ?? null,
    cover: raw.cover ?? "",
    coverColor: raw.coverColor ?? null,
    banner: raw.banner ?? null,
    status: raw.status ?? null,
    chapters: raw.chapters ?? null,
    volumes: raw.volumes ?? null,
    episodes: raw.episodes ?? null,
    duration: raw.duration ?? null,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    country: raw.country ?? null,
    isAdult: !!raw.isAdult,
    genres: safeJson(raw.genres, []),
    tags: safeJson(raw.tags, []),
    avgScore: raw.avgScore ?? null,
    popularity: raw.popularity ?? null,
    favourites: raw.favourites ?? null,
    authors: safeJson(raw.authors, []),
    extLinks: safeJson(raw.extLinks, []),
    source: raw.source ?? null,
    siteUrl: raw.siteUrl ?? null,
    lastUpdate: raw.lastUpdate ?? null,
    nextEpisodeAt: raw.nextEpisodeAt ?? null,
    nextEpisodeNum: raw.nextEpisodeNum ?? null,
  };
}

// ---------- Idiomas ----------
export interface LangInfo {
  code: string;
  label: string;
  status: "original" | "oficial" | "provavel" | "streaming";
}

const COUNTRY_LANG: Record<string, LangInfo> = {
  JP: { code: "ja", label: "Japonês (original)", status: "original" },
  KR: { code: "ko", label: "Coreano (original)", status: "original" },
  CN: { code: "zh", label: "Chinês (original)", status: "original" },
  TW: { code: "zh", label: "Chinês (original)", status: "original" },
};

const SITE_LANG_MAP: Record<string, string[]> = {
  MangaPlus: ["EN", "PT-BR", "ES"],
  Comikey: ["EN", "PT-BR", "ES"],
  Webtoons: ["EN", "FR", "DE", "ES"],
  Webtoon: ["EN", "FR", "DE", "ES"],
  Tapas: ["EN"],
  Tappytoon: ["EN", "FR", "DE"],
  Lezhin: ["EN", "KO"],
  "Pocket Comics": ["EN"],
  "Bilibili Comics": ["EN", "ZH"],
  VIZ: ["EN"],
  Kodansha: ["EN"],
  "Yen Press": ["EN"],
  "Seven Seas Entertainment": ["EN"],
  "J-Novel Club": ["EN"],
  BookWalker: ["EN", "JA"],
  "Azuki Media": ["EN"],
  Azuki: ["EN"],
  MangaPlanet: ["EN"],
  "Manga Museum": ["EN"],
  "Comic Walker": ["JA", "EN"],
  ComicWalker: ["JA", "EN"],
  NicoNico: ["JA"],
  Pixiv: ["JA", "EN"],
  "Square Enix": ["JA", "EN"],
  "Shueisha": ["JA"],
  Netflix: ["PT-BR*"],
  Crunchyroll: ["PT-BR*"],
  "Amazon Prime Video": ["PT-BR*"],
  HIDIVE: ["EN"],
  Hulu: ["EN"],
  "Anime Onegai": ["ES"],
  BilibiliTV: ["ZH", "EN"],
  "iQ.com": ["ZH", "EN"],
  MuseAsia: ["EN"],
  "Ani-One": ["EN"],
};

export function getLanguages(w: WorkData): LangInfo[] {
  const out: LangInfo[] = [];
  if (w.country && COUNTRY_LANG[w.country]) out.push(COUNTRY_LANG[w.country]);

  const set = new Map<string, LangInfo>();
  const hasType = w.type !== "anime";
  for (const l of w.extLinks ?? []) {
    const langs = SITE_LANG_MAP[l.site];
    if (!langs) continue;
    for (const raw of langs) {
      const streaming = raw.endsWith("*");
      const code = streaming ? raw.slice(0, -1) : raw;
      if (streaming) {
        if (!set.has(code)) set.set(code, { code, label: code === "PT-BR" ? "Português (legendado/dublado)" : `${code} (streaming)`, status: "streaming" });
      } else if (hasType || code === "EN") {
        if (!set.has(code)) set.set(code, { code, label: langLabel(code), status: "oficial" });
      }
    }
  }
  // heurística: obras muito populares costumam ter licença oficial em inglês e impresso em PT-BR
  const popular = (w.popularity ?? 0) >= 150000;
  if (hasType && popular && !set.has("EN")) set.set("EN", { code: "EN", label: "Inglês", status: "oficial" });
  if (hasType && (w.popularity ?? 0) >= 200000 && !set.has("PT-BR"))
    set.set("PT-BR", { code: "PT-BR", label: "Português (BR)", status: "provavel" });
  if (w.type === "anime" && !set.has("PT-BR"))
    set.set("PT-BR", { code: "PT-BR", label: "Português (BR)", status: "streaming" });

  for (const v of set.values()) out.push(v);
  return out;
}

function langLabel(code: string): string {
  switch (code) {
    case "EN": return "Inglês";
    case "ES": return "Espanhol";
    case "FR": return "Francês";
    case "DE": return "Alemão";
    case "JA": return "Japonês";
    case "KO": return "Coreano";
    case "ZH": return "Chinês";
    case "PT-BR": return "Português (BR)";
    default: return code;
  }
}

// ---------- Autoria ----------
const AUTHOR_ROLE_PRIORITY = /(original creator|original story|story & art|story|author|creator)/i;

export function mainAuthors(w: WorkData): AuthorRef[] {
  const primary = w.authors.filter((a) => AUTHOR_ROLE_PRIORITY.test(a.role));
  const rest = w.authors.filter((a) => !AUTHOR_ROLE_PRIORITY.test(a.role));
  return [...(primary.length ? primary : w.authors.slice(0, 2)), ...rest];
}

// ---------- Próximo capítulo ----------
export interface NextRelease {
  label: string;
  detail: string;
  dateISO?: string;
  kind: "anime" | "estimado" | "concluido" | "hiatus" | "futuro";
}

export function getNextRelease(w: WorkData): NextRelease | null {
  if (w.status === "FINISHED") {
    const qtd = w.type === "anime" ? `${w.episodes ?? "?"} eps` : `${w.chapters ?? "?"} caps`;
    return { label: "Concluído", detail: qtd, kind: "concluido" };
  }
  if (w.status === "HIATUS") return { label: "Em hiato", detail: "sem previsão oficial", kind: "hiatus" };
  if (w.status === "NOT_YET_RELEASED") {
    return { label: "Não lançado", detail: w.startDate ? `estreia prevista: ${fmtDate(w.startDate)}` : "sem data", kind: "futuro" };
  }
  if (w.status === "CANCELLED") return { label: "Cancelado", detail: "", kind: "hiatus" };

  if (w.type === "anime" && w.nextEpisodeAt) {
    const d = new Date(w.nextEpisodeAt);
    return {
      label: `Ep ${w.nextEpisodeNum ?? "?"} em ${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
      detail: d.toLocaleString("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" }),
      dateISO: w.nextEpisodeAt,
      kind: "anime",
    };
  }
  if (w.status === "RELEASING" && w.type !== "anime" && w.lastUpdate) {
    const last = new Date(w.lastUpdate * 1000);
    const cadence = w.country === "KR" || (w.tags ?? []).some((t) => t.name === "Long Strip") ? 7 : 7;
    const next = new Date(last.getTime() + cadence * 86400000);
    const now = Date.now();
    const diffDays = Math.round((next.getTime() - now) / 86400000);
    if (diffDays <= 0) {
      return {
        label: "Próx. cap a qualquer momento",
        detail: "estimativa: semanal (último lanç. " + last.toLocaleDateString("pt-BR") + ")",
        kind: "estimado",
      };
    }
    return {
      label: `Próx. cap ~ ${next.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`,
      detail: `estimativa semanal · faltam ~${diffDays} dia(s)`,
      dateISO: next.toISOString(),
      kind: "estimado",
    };
  }
  if (w.status === "RELEASING") {
    return { label: "Em lançamento", detail: "novo cap/ep em breve", kind: "estimado" };
  }
  return null;
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtNum(n?: number | null): string {
  if (n == null) return "—";
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(".0", "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(".0", "") + "k";
  return String(n);
}

export const COUNTRY_FLAG: Record<string, string> = {
  JP: "🇯🇵", KR: "🇰🇷", CN: "🇨🇳", TW: "🇹🇼",
};
