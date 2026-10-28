// Afiliados multi-país do OtakuVerse — CUSTO ZERO, SÓ RECEITA.
// O usuário escolhe (ou o navegador detecta) o país; o painel de compra mostra
// as lojas REAIS daquele país com busca direta pela obra. Links de Amazon levam
// o tag de associado do país quando configurado via env (NEXT_PUBLIC_AMAZON_TAG_*).
// Sem tag configurada o link segue limpo — nada quebra, só não comissiona.
//
// Conformidade: rel="sponsored noopener" (política Google), disclosure visível no
// painel, e NUNCA renderizamos para obras adult (o painel some na zona +18).

export type AffRegion =
  | "BR" | "PT" | "US" | "CA" | "UK" | "ES" | "MX" | "AR" | "CL" | "CO"
  | "FR" | "DE" | "IT" | "JP" | "GLOBAL";

export interface AffStore {
  id: string;
  name: string;
  kind: "livraria" | "ebook" | "sebo" | "marketplace" | "geek";
  /** Monta a URL de BUSCA da loja para a obra (título + formato quando ajuda). */
  url: (q: string, kind: WorkKind) => string;
  /** Env do tag de afiliado (Amazon por país). Ausente = link direto sem tag. */
  tagEnv?: string;
}

export type WorkKind = "manga" | "novel" | "anime";

const enc = encodeURIComponent;

// patamar de busca: título romaji/original + complemento útil por tipo
function query(title: string, kind: WorkKind, extra?: string): string {
  const base = kind === "manga" ? `${title} manga` : kind === "novel" ? `${title} light novel` : title;
  return extra ? `${base} ${extra}` : base;
}

/** Amazon com domínio e tag por país — Associates BR/US/ES/MX/JP/... são programas
 *  separados: cada país tem o SEU tracker (por isso o env é por região). */
function amazon(domain: string, tagEnv: string): AffStore {
  return {
    id: `amazon-${domain}`,
    name: "Amazon",
    kind: "livraria",
    tagEnv,
    url: (q, kind) => `https://www.amazon.${domain}/s?k=${enc(query(q, kind))}`,
  };
}

function mercadoLivre(domain: string): AffStore {
  return {
    id: `ml-${domain}`,
    name: "Mercado Livre",
    kind: "marketplace",
    url: (q) => `https://lista.mercadolivre.com.${domain}/${slug(q)}`,
  };
}

function slug(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

const GOOGLE_PLAY: AffStore = {
  id: "google-play",
  name: "Google Play Livros",
  kind: "ebook",
  url: (q) => `https://play.google.com/store/search?q=${enc(q)}&c=books`,
};

const BOOKWALKER_GLOBAL: AffStore = {
  id: "bookwalker-global",
  name: "BOOK☆WALKER Global",
  kind: "ebook",
  url: (q) => `https://global.bookwalker.jp/search/?word=${enc(q)}`,
};

const KOBO: AffStore = {
  id: "kobo",
  name: "Rakuten Kobo",
  kind: "ebook",
  url: (q, _kind) => `https://www.kobo.com/search?query=${enc(q)}`,
};

export const REGIONS: Record<AffRegion, { label: string; stores: AffStore[] }> = {
  BR: {
    label: "Brasil",
    stores: [
      amazon("com.br", "NEXT_PUBLIC_AMAZON_TAG_BR"),
      { id: "ml-br", name: "Mercado Livre", kind: "marketplace", url: (q) => `https://lista.mercadolivre.com.br/${slug(q)}` },
      { id: "estante", name: "Estante Virtual (sebos)", kind: "sebo", url: (q) => `https://www.estantevirtual.com.br/resultadopesquisa?q=${enc(q)}` },
      { id: "americanas", name: "Americanas", kind: "livraria", url: (q) => `https://www.americanas.com.br/busca/${slug(q)}` },
      { id: "kobo-br", name: "Kobo (ebooks)", kind: "ebook", url: (q) => `https://www.kobo.com/br/pt/search?query=${enc(q)}` },
      { id: "gplay-br", name: "Google Play Livros", kind: "ebook", url: (q) => `https://play.google.com/store/search?q=${enc(q)}&c=books&gl=BR` },
    ],
  },
  PT: {
    label: "Portugal",
    stores: [
      { ...amazon("es", "NEXT_PUBLIC_AMAZON_TAG_ES"), name: "Amazon (Espanha)" },
      { id: "wook", name: "Wook", kind: "livraria", url: (q) => `https://www.wook.pt/pesquisa?q=${enc(q)}` },
      { id: "bertrand", name: "Bertrand", kind: "livraria", url: (q) => `https://www.bertrand.pt/pesquisa/?searchterm=${enc(q)}` },
    ],
  },
  US: {
    label: "Estados Unidos",
    stores: [
      amazon("com", "NEXT_PUBLIC_AMAZON_TAG_US"),
      { id: "bn", name: "Barnes & Noble", kind: "livraria", url: (q) => `https://www.barnesandnoble.com/s/${enc(q)}` },
      { id: "rightstuf", name: "RightStuf (geek)", kind: "geek", url: (q) => `https://www.rightstufanime.com/search?keyword=${enc(q)}` },
      { ...BOOKWALKER_GLOBAL },
      { ...GOOGLE_PLAY },
    ],
  },
  CA: {
    label: "Canadá",
    stores: [
      amazon("ca", "NEXT_PUBLIC_AMAZON_TAG_CA"),
      { id: "indigo", name: "Indigo", kind: "livraria", url: (q) => `https://www.indigo.ca/en-ca/search?q=${enc(q)}` },
    ],
  },
  UK: {
    label: "Reino Unido",
    stores: [
      amazon("co.uk", "NEXT_PUBLIC_AMAZON_TAG_UK"),
      { id: "waterstones", name: "Waterstones", kind: "livraria", url: (q) => `https://www.waterstones.com/book/search/term/${enc(q)}` },
      { ...BOOKWALKER_GLOBAL },
    ],
  },
  ES: {
    label: "España",
    stores: [
      amazon("es", "NEXT_PUBLIC_AMAZON_TAG_ES"),
      { id: "casadellibro", name: "Casa del Libro", kind: "livraria", url: (q) => `https://www.casadellibro.com/busqueda-libro?busqueda=${enc(q)}` },
      { id: "fnac-es", name: "Fnac", kind: "livraria", url: (q) => `https://www.fnac.es/Search?Search=${enc(q)}` },
    ],
  },
  MX: {
    label: "México",
    stores: [
      amazon("com.mx", "NEXT_PUBLIC_AMAZON_TAG_MX"),
      { id: "gandhi", name: "Gandhi", kind: "livraria", url: (q) => `https://www.gandhi.com.mx/search?q=${enc(q)}` },
      { id: "ml-mx", name: "Mercado Libre", kind: "marketplace", url: (q) => `https://listado.mercadolibre.com.mx/${slug(q)}` },
    ],
  },
  AR: {
    label: "Argentina",
    stores: [
      { id: "ml-ar", name: "Mercado Libre", kind: "marketplace", url: (q) => `https://listado.mercadolibre.com.ar/${slug(q)}` },
      { ...amazon("com", "NEXT_PUBLIC_AMAZON_TAG_US"), name: "Amazon (internacional)" },
    ],
  },
  CL: {
    label: "Chile",
    stores: [
      { id: "ml-cl", name: "Mercado Libre", kind: "marketplace", url: (q) => `https://listado.mercadolibre.cl/${slug(q)}` },
      { ...amazon("com", "NEXT_PUBLIC_AMAZON_TAG_US"), name: "Amazon (internacional)" },
    ],
  },
  CO: {
    label: "Colombia",
    stores: [
      { id: "ml-co", name: "Mercado Libre", kind: "marketplace", url: (q) => `https://listado.mercadolibre.com.co/${slug(q)}` },
      { ...amazon("com", "NEXT_PUBLIC_AMAZON_TAG_US"), name: "Amazon (internacional)" },
    ],
  },
  FR: {
    label: "France",
    stores: [
      amazon("fr", "NEXT_PUBLIC_AMAZON_TAG_FR"),
      { id: "fnac-fr", name: "Fnac", kind: "livraria", url: (q) => `https://www.fnac.com/Search?Search=${enc(q)}` },
      { id: "kobo-fr", name: "Kobo (ebooks)", kind: "ebook", url: (q) => `https://www.kobo.com/fr/fr/search?query=${enc(q)}` },
    ],
  },
  DE: {
    label: "Deutschland",
    stores: [
      amazon("de", "NEXT_PUBLIC_AMAZON_TAG_DE"),
      { id: "thalia", name: "Thalia", kind: "livraria", url: (q) => `https://www.thalia.de/suche?sq=${enc(q)}` },
    ],
  },
  IT: {
    label: "Italia",
    stores: [
      amazon("it", "NEXT_PUBLIC_AMAZON_TAG_IT"),
      { id: "ibs", name: "IBS", kind: "livraria", url: (q) => `https://www.ibs.it/search?query=${enc(q)}` },
    ],
  },
  JP: {
    label: "日本",
    stores: [
      amazon("co.jp", "NEXT_PUBLIC_AMAZON_TAG_JP"),
      { id: "rakuten-books", name: "楽天ブックス", kind: "livraria", url: (q) => `https://books.rakuten.co.jp/search/?sitem=${enc(q)}` },
      { id: "bookwalker-jp", name: "BOOK☆WALKER", kind: "ebook", url: (q) => `https://bookwalker.jp/search/?word=${enc(q)}` },
      { id: "cdjapan", name: "CDJapan (imports)", kind: "geek", url: (q) => `https://www.cdjapan.co.jp/search?term.term=${enc(q)}` },
    ],
  },
  GLOBAL: {
    label: "Internacional",
    stores: [
      { ...amazon("com", "NEXT_PUBLIC_AMAZON_TAG_US"), name: "Amazon (internacional)" },
      { ...BOOKWALKER_GLOBAL },
      { ...GOOGLE_PLAY },
      { ...KOBO },
    ],
  },
};

export const REGION_KEYS = Object.keys(REGIONS) as AffRegion[];

/** Tipo de obra → complemento de busca (mangá vs novel vs anime/blu-ray). */
export function workKindOf(w: { type: string; format?: string | null }): WorkKind {
  if (w.type === "anime") return "anime";
  if (w.type === "webnovel") return "novel";
  if (w.format === "NOVEL" || w.type === "lightnovel") return "novel";
  return "manga";
}

export interface StoreLink {
  id: string;
  name: string;
  kind: AffStore["kind"];
  url: string;
  /** true = tem tag de afiliado configurado (comissiona) */
  affiliate: boolean;
}

// Tags de afiliado (Amazon Associates — um programa POR país). Acesso LITERAL ao
// process.env: o Next só inlina NEXT_PUBLIC_* em acesso direto, e este módulo roda
// também no navegador (painel de compra é client-side).
export const AFFILIATE_TAGS: Record<string, string> = {
  NEXT_PUBLIC_AMAZON_TAG_BR: process.env.NEXT_PUBLIC_AMAZON_TAG_BR ?? "",
  NEXT_PUBLIC_AMAZON_TAG_US: process.env.NEXT_PUBLIC_AMAZON_TAG_US ?? "",
  NEXT_PUBLIC_AMAZON_TAG_CA: process.env.NEXT_PUBLIC_AMAZON_TAG_CA ?? "",
  NEXT_PUBLIC_AMAZON_TAG_UK: process.env.NEXT_PUBLIC_AMAZON_TAG_UK ?? "",
  NEXT_PUBLIC_AMAZON_TAG_ES: process.env.NEXT_PUBLIC_AMAZON_TAG_ES ?? "",
  NEXT_PUBLIC_AMAZON_TAG_MX: process.env.NEXT_PUBLIC_AMAZON_TAG_MX ?? "",
  NEXT_PUBLIC_AMAZON_TAG_FR: process.env.NEXT_PUBLIC_AMAZON_TAG_FR ?? "",
  NEXT_PUBLIC_AMAZON_TAG_DE: process.env.NEXT_PUBLIC_AMAZON_TAG_DE ?? "",
  NEXT_PUBLIC_AMAZON_TAG_IT: process.env.NEXT_PUBLIC_AMAZON_TAG_IT ?? "",
  NEXT_PUBLIC_AMAZON_TAG_JP: process.env.NEXT_PUBLIC_AMAZON_TAG_JP ?? "",
};

/** Constrói os links de compra para a região — puro (servidor e cliente usam). */
export function storesFor(region: AffRegion, title: string, kind: WorkKind): StoreLink[] {
  const regionDef = REGIONS[region] ?? REGIONS.GLOBAL;
  return regionDef.stores.map((s) => {
    const tag = s.tagEnv ? (AFFILIATE_TAGS[s.tagEnv] ?? "").trim() : "";
    let url = s.url(title, kind);
    if (tag) url += (url.includes("?") ? "&" : "?") + `tag=${enc(tag)}`;
    return { id: s.id, name: s.name, kind: s.kind, url, affiliate: !!tag };
  });
}

const LS_KEY = "ov_aff_region";

/** País preferido do usuário (override manual salvo em localStorage). */
export function getRegionOverride(): AffRegion | null {
  if (typeof window === "undefined") return null;
  try {
    const v = localStorage.getItem(LS_KEY) as AffRegion | null;
    return v && REGION_KEYS.includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function setRegionOverride(r: AffRegion | null) {
  try {
    if (r) localStorage.setItem(LS_KEY, r);
    else localStorage.removeItem(LS_KEY);
  } catch {}
}

/** Detecção: override manual > idioma do navegador > Brasil (idioma base do site). */
export function detectRegion(): AffRegion {
  const over = getRegionOverride();
  if (over) return over;
  if (typeof navigator === "undefined") return "BR";
  const langs = [navigator.language, ...(navigator.languages ?? [])].filter(Boolean) as string[];
  for (const l of langs) {
    const [, region] = l.split("-");
    if (!region) continue;
    const up = region.toUpperCase();
    if (REGION_KEYS.includes(up as AffRegion)) return up as AffRegion;
  }
  return "BR"; // site pt-BR: o default sensível é o mercado brasileiro
}
