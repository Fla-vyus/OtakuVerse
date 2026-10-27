// Notícias: alimentadas por DADOS REAIS ao vivo (AniList trending/estreias/marcos).
// Cada item tem imagem real (banner/capa da própria obra) e link para o detalhe.
import { anilistFetch, toWorkRow } from "@/lib/anilist";
import { parseWork, type WorkData, fmtDate, fmtNum } from "@/lib/types";

export interface NewsItem {
  id: string;
  kind: "hype" | "estreia" | "marco" | "retorno" | "temporada";
  title: string;
  summary: string;
  image: string | null;
  date: string;
  workId: string;
  badge: string;
}

const g = globalThis as unknown as { __newsCache?: { at: number; items: NewsItem[] } };
const TTL = 15 * 60_000;

export async function buildNews(pool: WorkData[]): Promise<NewsItem[]> {
  if (g.__newsCache && Date.now() - g.__newsCache.at < TTL) return g.__newsCache.items;
  const items: NewsItem[] = [];
  const now = Date.now();

  // 1) Ao vivo: o que está em tendência AGORA na AniList (hype real)
  try {
    const data = await anilistFetch(
      `query { Page(perPage: 8) { media(sort: TRENDING_DESC, isAdult: false) { id bannerImage coverImage { extraLarge } trending title { romaji } averageScore format episodes chapters nextAiringEpisode { episode } } } }`,
      {}
    );
    for (const m of data?.Page?.media ?? []) {
      items.push({
        id: `hype-${m.id}`,
        kind: "hype",
        title: `${m.title?.romaji ?? "Obra"} dispara no hype`,
        summary:
          m.format === "TV" || m.format === "ONA"
            ? `Entrou no top de tendência com ${fmtNum(m.popularity ?? 0)} pessoas acompanhando${m.nextAiringEpisode ? ` — ep ${m.nextAiringEpisode.episode} chega logo` : ""}.`
            : `Um dos títulos mais comentados do momento (${fmtNum(m.popularity ?? 0)} leitores acompanhando na fonte).`,
        image: m.bannerImage ?? m.coverImage?.extraLarge ?? null,
        date: new Date().toISOString(),
        workId: String(m.id),
        badge: "Hype agora",
      });
    }
  } catch {}

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
      image: w.banner ?? w.cover,
      date: isFuture ? new Date(now).toISOString() : (w.startDate!.length === 10 ? w.startDate + "T12:00:00Z" : w.startDate!),
      workId: w.id,
      badge: isFuture ? "Chega em" : "Estreia",
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
      image: w.banner ?? w.cover,
      date: w.nextEpisodeAt!,
      workId: w.id,
      badge: "Retorna",
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
      image: w.banner ?? w.cover,
      date: w.startDate ? w.startDate + "T12:00:00Z" : new Date().toISOString(),
      workId: w.id,
      badge: "Marco",
    });
  }

  items.sort((a, b) => b.date.localeCompare(a.date));
  g.__newsCache = { at: Date.now(), items: items.slice(0, 16) };
  return g.__newsCache.items;
}
