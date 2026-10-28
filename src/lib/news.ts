// Notícias: alimentadas por DADOS REAIS ao vivo (AniList + Kitsu como fonte redundante)
// + camada editorial: cada item ganha texto de notícia bem escrito (fatos reais do banco,
// nada inventado — números, datas e créditos vêm dos metadados indexados).
// Cada item tem imagem real (banner/capa da própria obra) e link para o detalhe.
import { anilistFetch } from "@/lib/anilist";
import { type WorkData, fmtDate, fmtNum } from "@/lib/types";

export interface NewsItem {
  id: string;
  kind: "hype" | "estreia" | "marco" | "retorno" | "temporada";
  title: string;
  summary: string;
  body: string; // texto editorial completo (parágrafos separados por \n\n)
  image: string | null;
  imageWide?: boolean; // true = banner paisagem (recobre bem) · false/ausente = capa retrato (UI usa contain + blur)
  date: string;
  workId: string | null; // null quando a fonte externa não casou com o catálogo
  badge: string;
  source: string; // AniList | Kitsu | Catálogo
}

const g = globalThis as unknown as { __newsCache?: { at: number; items: NewsItem[] }; __newsBuilding?: Promise<NewsItem[]> };
const TTL = 15 * 60_000;

const WD_NAME = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

// aberturas rotativas — evita que 8 notícias de hype comecem todas igual
const HYPE_LEADS = [
  (t: string) => `${t} disparou nas tendências e é o nome que todo mundo está comentando hoje`,
  (t: string) => `O hype não mente: ${t} ocupa o topo das tendências neste momento`,
  (t: string) => `${t} é o assunto do dia entre os fãs — e com bons motivos`,
  (t: string) => `Ninguém segurou: ${t} explodiu no radar da comunidade`,
  (t: string) => `Momento de prestar atenção: ${t} está entre as obras mais quentes do momento`,
  (t: string) => `${t} ganhou força de repente e não saiu mais das tendências`,
  (t: string) => `A comunidade escolheu: ${t} domina as conversas de hoje`,
  (t: string) => `Em plena ${WD_NAME[new Date().getDay()]}, ${t} reina nas tendências`,
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

/** Qualidade de imagem nas notícias: o pool guarda capas "large" (~230px) —
 *  esticadas para ~700px viram borrão. O CDN da AniList serve "extraLarge" (~460px)
 *  no MESMO nome de arquivo: basta trocar o segmento de tamanho. Banner já é 1050px. */
function hiResCover(u: string): string {
  return u.replace("/cover/large/", "/cover/extraLarge/");
}

/** Procura a obra no pool por id (e, se vier de fonte externa, por título normalizado). */
const norm = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function findInPool(pool: WorkData[], id?: string, titles?: string[]): WorkData | undefined {
  if (id && pool.some((w) => w.id === id)) return pool.find((w) => w.id === id);
  if (titles?.length) {
    const wanted = titles.map(norm).filter((t) => t.length >= 4);
    for (const t of wanted) {
      const hit = pool.find(
        (w) =>
          norm(w.title) === t ||
          norm(w.titleEn ?? "") === t ||
          norm(w.titleNative ?? "") === t ||
          (w.synonyms ?? []).some((s) => norm(s) === t)
      );
      if (hit) return hit;
    }
  }
  return undefined;
}

/** Contexto editorial a partir de metadados REAIS da obra (créditos, revista, números). */
function contextParagraph(w: WorkData): string {
  const parts: string[] = [];
  const author = w.authors.find((a) => /autor|original|story|creator/i.test(a.role)) ?? w.authors[0];
  if (w.type === "anime") {
    if (author && !/adr|director/i.test(author.role)) parts.push(`com direção creditada a ${author.name}`);
  } else if (author) {
    parts.push(`criação de ${author.name}`);
  }
  if (w.magazine?.name) parts.push(`publicada na ${w.magazine.name}`);
  if (w.startDate) parts.push(`em circulação desde ${fmtDate(w.startDate)}`);
  const mid = parts.length ? ` A produção${parts.length > 1 ? " — " + parts.slice(0, -1).join(", ") + " — " : " "}${parts[parts.length - 1]}` : "";
  const nums: string[] = [];
  if (w.avgScore) nums.push(`nota média de ${w.avgScore}%`);
  if (w.chapters) nums.push(`${fmtNum(w.chapters)} capítulos publicados`);
  else if (w.episodes) nums.push(`${w.episodes} episódios`);
  nums.push(`${fmtNum(w.favourites ?? 0)} favoritos na fonte`);
  const end = nums.length ? `${mid ? "." : ""} Até agora, soma ${nums.slice(0, -1).join(", ")}${nums.length > 1 ? " e " : ""}${nums[nums.length - 1]}.` : "";
  return mid + end;
}

/** Fonte 2 (redundância): Kitsu — entra quando a AniList falha ou para complementar o feed. */
async function kitsuTrending(kind: "anime" | "manga", limit = 8): Promise<{ id: string; titles: string[]; image: string | null; userCount: number; desc: string | null }[]> {
  const url = `https://kitsu.io/api/edge/${kind}?sort=-userCount&page[limit]=${limit}&filter[subtype]=${kind === "anime" ? "TV" : "manga"}`;
  const res = await fetch(url, {
    headers: { Accept: "application/vnd.api+json", "User-Agent": "OtakuVerse/1.0 (portal de descoberta)" },
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Kitsu ${res.status}`);
  const json: any = await res.json();
  return (json?.data ?? []).map((d: any) => {
    const a = d.attributes ?? {};
    return {
      id: String(d.id),
      titles: [a.canonicalTitle, a.titles?.en, a.titles?.en_jp, a.titles?.ja_jp].filter(Boolean),
      image: a.posterImage?.original ?? a.posterImage?.large ?? null,
      userCount: a.userCount ?? 0,
      desc: a.description ? String(a.description).replace(/<[^>]*>/g, "").slice(0, 400) : null,
    };
  });
}

/** Ao vivo: o que está em tendência AGORA (AniList; cai para Kitsu em caso de falha — fonte dupla). */
async function liveHypeItems(pool: WorkData[]): Promise<NewsItem[]> {
  const items: NewsItem[] = [];
  let source = "AniList";
  try {
    const data = await anilistFetch(
      `query { Page(perPage: 8) { media(sort: TRENDING_DESC, isAdult: false) { id bannerImage coverImage { extraLarge } trending title { romaji } averageScore format episodes chapters popularity nextAiringEpisode { episode } } } }`,
      {},
      { timeoutMs: 7000 }
    );
    const media: any[] = data?.Page?.media ?? [];
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      const title = m.title?.romaji ?? "Obra";
      const lead = pick(HYPE_LEADS, i)(title);
      const summary =
        m.format === "TV" || m.format === "ONA"
          ? `Entrou no top de tendência com ${fmtNum(m.popularity ?? 0)} pessoas acompanhando${m.nextAiringEpisode ? ` — ep ${m.nextAiringEpisode.episode} chega logo` : ""}.`
          : `Um dos títulos mais comentados do momento (${fmtNum(m.popularity ?? 0)} leitores acompanhando na fonte).`;
      const dbWork = findInPool(pool, String(m.id));
      const ctx = dbWork ? " " + contextParagraph(dbWork) : m.averageScore ? ` Nota média de ${m.averageScore}% na agregação.` : "";
      items.push({
        id: `hype-${m.id}`,
        kind: "hype",
        title: `${title} dispara no hype`,
        summary,
        body: `${lead}. ${summary}${ctx}${m.nextAiringEpisode ? `\n\nO próximo episódio (${m.nextAiringEpisode.episode}) já tem data marcada — vale deixar na lista para não perder o embalo.` : ""}`,
        image: m.bannerImage ?? (m.coverImage?.extraLarge ? hiResCover(m.coverImage.extraLarge) : null),
        imageWide: !!m.bannerImage,
        date: new Date().toISOString(),
        workId: String(m.id),
        badge: "Hype agora",
        source,
      });
    }
  } catch {
    // Fonte 2: Kitsu (títulos casados com nosso catálogo quando possível)
    try {
      source = "Kitsu";
      const [an, mg] = await Promise.all([kitsuTrending("anime", 6), kitsuTrending("manga", 4).catch(() => [])]);
      const merged = [...an, ...mg].slice(0, 8);
      for (let i = 0; i < merged.length; i++) {
        const k = merged[i];
        const hit = findInPool(pool, undefined, k.titles);
        const title = hit?.title ?? k.titles[0] ?? "Obra em alta";
        items.push({
          id: `kitsu-${k.id}`,
          kind: "hype",
          title: `${title} figura entre os mais acompanhados`,
          summary: `Está entre os títulos com mais seguidores cadastrados na fonte alternativa (${fmtNum(k.userCount)} usuários).`,
          body: `${pick(HYPE_LEADS, i)(title)} — pelos dados da fonte alternativa, acumula ${fmtNum(k.userCount)} seguidores cadastrados.${hit ? " " + contextParagraph(hit) : k.desc ? `\n\n${k.desc}` : ""}`,
          image: hit ? (hit.banner ?? hiResCover(hit.cover)) : k.image,
          imageWide: !!hit?.banner,
          date: new Date().toISOString(),
          workId: hit?.id ?? null,
          badge: "Em alta",
          source,
        });
      }
    } catch {
      // as duas fontes caíram — o feed segue só com dados do catálogo (abaixo), que não falham
    }
  }
  return items;
}

/** Constrói o feed completo. Estratégia nunca-bloqueia:
 *  - cache fresco → devolve;
 *  - cache stale → devolve stale na hora e revalida em background;
 *  - sem cache → parte de estreias/retornos/marcos do catálogo (instantâneo) e espera só o bloco ao vivo (com timeout curto). */
export async function buildNews(pool: WorkData[]): Promise<NewsItem[]> {
  if (g.__newsCache && Date.now() - g.__newsCache.at < TTL) return g.__newsCache.items;
  if (g.__newsCache) {
    // stale-while-revalidate
    if (!g.__newsBuilding) g.__newsBuilding = buildNewsInner(pool).catch(() => g.__newsCache?.items ?? []);
    void g.__newsBuilding;
    return g.__newsCache.items;
  }
  return buildNewsInner(pool);
}

async function buildNewsInner(pool: WorkData[]): Promise<NewsItem[]> {
  if (g.__newsBuilding) return g.__newsBuilding;
  const job = (async () => {
    const items: NewsItem[] = [];
    const now = Date.now();

    // 1) Ao vivo (AniList → Kitsu em caso de falha)
    items.push(...(await liveHypeItems(pool)));

    // 2) Estreias recentes no catálogo (dados reais de data) — separa lançadas de previstas
    const debuts = [...pool]
      .filter((w) => w.startDate && w.startDate >= new Date(now - 60 * 86400000).toISOString().slice(0, 10) && w.cover && (w.popularity ?? 0) >= 5000)
      .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
      .slice(0, 4);
    for (const w of debuts) {
      const isFuture = (w.startDate ?? "") > new Date(now).toISOString().slice(0, 10);
      items.push({
        id: `estreia-${w.id}`,
        kind: "estreia",
        title: isFuture ? `${w.title}: estreia marcada` : `${w.title} estreia`,
        summary: isFuture
          ? `Nova produção confirmada para ${fmtDate(w.startDate)}${w.episodes ? ` com ${w.episodes} episódios previstos` : ""}. Já pode favoritar!`
          : `Disponível desde ${fmtDate(w.startDate)}${w.episodes ? ` com ${w.episodes} episódios previstos` : ""}. Nota média ${w.avgScore ?? "?"}%.`,
        body: isFuture
          ? `A contagem regressiva começou: ${w.title} tem estreia confirmada para ${fmtDate(w.startDate)}${w.episodes ? ` com previsão de ${w.episodes} episódios` : ""}.\n\n${contextParagraph(w)} Quem quiser entrar cedo já pode salvar na biblioteca e acompanhar o lançamento capítulo a capítulo.`
          : `${w.title} está oficialmente disponível desde ${fmtDate(w.startDate)}${w.episodes ? ` — são ${w.episodes} episódios previstos` : ""}.\n\n${contextParagraph(w)} Com esse currículo inicial, a tendência é o boca a boca crescer nas próximas semanas.`,
        image: w.banner ?? hiResCover(w.cover),
        imageWide: !!w.banner,
        date: isFuture ? new Date(now).toISOString() : (w.startDate!.length === 10 ? w.startDate + "T12:00:00Z" : w.startDate!),
        workId: w.id,
        badge: isFuture ? "Chega em" : "Estreia",
        source: "Catálogo",
      });
    }

    // 3) Retornos confirmados (animes com próximo episódio datado — dado real)
    const returning = [...pool]
      .filter((w) => w.nextEpisodeAt && new Date(w.nextEpisodeAt).getTime() > now && w.nextEpisodeAt < new Date(now + 10 * 86400000).toISOString())
      .sort((a, b) => (a.nextEpisodeAt ?? "").localeCompare(b.nextEpisodeAt ?? ""))
      .slice(0, 4);
    for (const w of returning) {
      const d = new Date(w.nextEpisodeAt!);
      items.push({
        id: `retorno-${w.id}`,
        kind: "retorno",
        title: `${w.title} volta com o ep ${w.nextEpisodeNum}`,
        summary: `Próximo episódio confirmado: ${d.toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" })} (${d.toLocaleDateString("pt-BR")}).`,
        body: `A pausa acabou: ${w.title} retorna com o episódio ${w.nextEpisodeNum ?? "seguinte"} confirmado para ${d.toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" })} (${d.toLocaleDateString("pt-BR")}) — horário já convertido para o seu fuso.\n\n${contextParagraph(w)}`,
        image: w.banner ?? hiResCover(w.cover),
        imageWide: !!w.banner,
        date: w.nextEpisodeAt!,
        workId: w.id,
        badge: "Retorna",
        source: "Catálogo",
      });
    }

    // 4) Marcos: obras mais favoritadas dos últimos anos (recordes reais)
    const milestones = [...pool]
      .filter((w) => (w.favourites ?? 0) >= 40000)
      .sort((a, b) => (b.favourites ?? 0) - (a.favourites ?? 0))
      .slice(0, 3);
    for (const w of milestones) {
      items.push({
        id: `marco-${w.id}`,
        kind: "marco",
        title: `${w.title}: ${fmtNum(w.favourites)} favoritos`,
        summary: `Consolidado entre as obras mais amadas da história — nota ${w.avgScore ?? "?"}% e ${fmtNum(w.popularity)} usuários acompanhando.`,
        body: `Alguns números falam por si: ${w.title} já acumula ${fmtNum(w.favourites)} favoritos e ${fmtNum(w.popularity)} usuários acompanhando, com nota média de ${w.avgScore ?? "?"}%.\n\n${contextParagraph(w)} É o tipo de obra que atravessa gerações de leitores — se você ainda não conferiu, está na hora.`,
        image: w.banner ?? hiResCover(w.cover),
        imageWide: !!w.banner,
        date: w.startDate ? w.startDate + "T12:00:00Z" : new Date().toISOString(),
        workId: w.id,
        badge: "Marco",
        source: "Catálogo",
      });
    }

    items.sort((a, b) => b.date.localeCompare(a.date));
    g.__newsCache = { at: Date.now(), items: items.slice(0, 16) };
    g.__newsBuilding = undefined;
    return g.__newsCache.items;
  })();
  g.__newsBuilding = job;
  return job;
}
