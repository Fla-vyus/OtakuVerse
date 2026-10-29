// Página pública e INDEXÁVEL de cada obra — a maior alavanca de SEO do portal.
// Server Component (SSR): o Google recebe HTML completo com h1, metatags dinâmicas,
// JSON-LD e a capa. A zona adulta NUNCA é indexável (notFound) — blindagem legal.
// A SPA continua navegando por hash (#/obra/ID); esta página coexiste para busca,
// compartilhamento em redes e abertura por link direto (WhatsApp, Discord, etc.).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Work as DbWork } from "@prisma/client";

export const revalidate = 3600; // HTML cacheado 1h — barato e sempre fresco o bastante

const TYPE_LABEL: Record<string, string> = {
  manga: "Mangá",
  manhwa: "Manhwa",
  manhua: "Manhua",
  lightnovel: "Light Novel",
  webnovel: "Webnovel",
  anime: "Anime",
};

const STATUS_LABEL: Record<string, string> = {
  RELEASING: "Em publicação",
  FINISHED: "Concluído",
  HIATUS: "Em hiato",
  NOT_YET_RELEASED: "Ainda não lançado",
  CANCELLED: "Cancelado",
};

const COUNTRY_LABEL: Record<string, string> = {
  JP: "Japão",
  KR: "Coreia do Sul",
  CN: "China",
  TW: "Taiwan",
  TH: "Tailândia",
  ES: "Espanha",
};

function stripHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&hellip;/g, "…")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function fmtAuthors(w: DbWork): string {
  try {
    const arr = JSON.parse(w.authors ?? "[]") as { name: string; role?: string }[];
    if (!Array.isArray(arr) || !arr.length) return "";
    return arr.slice(0, 3).map((a) => a.name).join(", ");
  } catch {
    return "";
  }
}

function parseTags(w: DbWork): { name: string; rank: number }[] {
  try {
    const arr = JSON.parse(w.tags ?? "[]");
    return Array.isArray(arr) ? arr.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function parseGenres(w: DbWork): string[] {
  try {
    const arr = JSON.parse(w.genres ?? "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Nunca serve/indexa conteúdo adulto — a Zona +18 só existe logada, atrás do modo.
async function getWork(id: string): Promise<DbWork | null> {
  if (!/^[a-zA-Z0-9_-]{1,40}$/.test(id)) return null;
  try {
    const w = await db.work.findUnique({ where: { id } });
    if (!w) return null;
    if (w.isAdult || w.classification === "adult" || w.type === "drama") return null;
    return w;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const w = await getWork(id);
  if (!w) return { title: "Obra não encontrada — OtakuVerse", robots: { index: false, follow: true } };
  const desc = stripHtml(w.synopsisPT || w.synopsis).slice(0, 158) || `Descubra ${w.title} no OtakuVerse.`;
  const img = `/api/img?u=${encodeURIComponent(w.cover)}`;
  const kind = TYPE_LABEL[w.type] ?? "Obra";
  return {
    title: `${w.title} — ${kind} no OtakuVerse`,
    description: desc,
    alternates: { canonical: `/obra/${w.id}` },
    openGraph: {
      title: `${w.title} — ${kind}`,
      description: desc,
      type: "article",
      url: `/obra/${w.id}`,
      images: [{ url: img, width: 460, height: 660, alt: `Capa de ${w.title}` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${w.title} — ${kind}`,
      description: desc,
      images: [img],
    },
  };
}

export default async function WorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = await getWork(id);
  if (!w) notFound();

  const kind = TYPE_LABEL[w.type] ?? "Obra";
  const desc = stripHtml(w.synopsisPT || w.synopsis);
  const descEn = desc ? "" : stripHtml(w.synopsis);
  const genres = parseGenres(w);
  const tags = parseTags(w);
  const authors = fmtAuthors(w);
  const year = w.startDate?.slice(0, 4) ?? null;
  const score = w.avgScore ? (w.avgScore / 10).toFixed(1) : null;

  // JSON-LD: dado estruturado que Google entende (ComicStory/Movie + rating)
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": w.type === "anime" ? "Movie" : "ComicStory",
    name: w.title,
    ...(w.titleNative ? { alternateName: w.titleNative } : {}),
    ...(desc ? { description: desc.slice(0, 500) } : {}),
    ...(w.cover ? { image: `/api/img?u=${encodeURIComponent(w.cover)}` } : {}),
    ...(authors ? { author: { "@type": "Person", name: authors.split(", ")[0] } } : {}),
    ...(genres.length ? { genre: genres } : {}),
    ...(w.country && COUNTRY_LABEL[w.country] ? { countryOfOrigin: COUNTRY_LABEL[w.country] } : {}),
    ...(score
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: score,
            bestRating: "10",
            worstRating: "0",
            ratingCount: w.favourites ?? w.popularity ?? undefined,
          },
        }
      : {}),
  };

  const info: [string, string][] = [
    ["Formato", kind],
    ...(w.status && STATUS_LABEL[w.status] ? ([["Situação", STATUS_LABEL[w.status]]] as [string, string][]) : []),
    ...(w.chapters ? ([["Capítulos", String(w.chapters)]] as [string, string][]) : []),
    ...(w.volumes ? ([["Volumes", String(w.volumes)]] as [string, string][]) : []),
    ...(w.episodes ? ([["Episódios", String(w.episodes)]] as [string, string][]) : []),
    ...(year ? ([["Ano", year]] as [string, string][]) : []),
    ...(w.country && COUNTRY_LABEL[w.country] ? ([["Origem", COUNTRY_LABEL[w.country]]] as [string, string][]) : []),
    ...(authors ? ([["Autoria", authors]] as [string, string][]) : []),
  ];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Link href="/" className="hover:text-foreground hover:underline">OtakuVerse</Link>
        <span className="mx-1.5">/</span>
        <span>{kind}</span>
      </p>

      <div className="flex flex-col gap-7 sm:flex-row">
        {/* Capa */}
        <div
          className="w-44 shrink-0 self-start overflow-hidden rounded-2xl border border-border shadow-xl sm:w-56"
          style={{ background: w.coverColor ? `${w.coverColor}22` : "var(--muted)" }}
        >
          <img
            src={`/api/img?u=${encodeURIComponent(w.cover)}`}
            alt={`Capa de ${w.title}`}
            width={460}
            height={660}
            referrerPolicy="no-referrer"
            className="h-auto w-full object-cover"
          />
        </div>

        {/* Informações */}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-black leading-tight tracking-tight sm:text-4xl">{w.title}</h1>
          {w.titleNative && w.titleNative !== w.title && (
            <p lang="ja" className="mt-1 text-sm text-muted-foreground">{w.titleNative}</p>
          )}
          {(w.titleEn || w.synonyms) && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {[w.titleEn, ...(() => { try { return (JSON.parse(w.synonyms ?? "[]") as string[]).slice(0, 2); } catch { return []; } })()]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}

          {score && (
            <p className="mt-3 flex items-center gap-1.5">
              <span className="rounded-lg bg-amber-500/15 px-2 py-0.5 text-sm font-black text-amber-600 dark:text-amber-400">
                ★ {score}/10
              </span>
              <span className="text-xs text-muted-foreground">nota da comunidade</span>
            </p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            {info.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{k}</dt>
                <dd className="truncate font-semibold">{v}</dd>
              </div>
            ))}
          </dl>

          {genres.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {genres.map((g) => (
                <li key={g} className="rounded-full border border-border bg-secondary px-2.5 py-0.5 text-xs font-semibold">{g}</li>
              ))}
            </ul>
          )}
          {tags.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t.name} className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">{t.name}</li>
              ))}
            </ul>
          )}

          {(desc || descEn) && (
            <div className="mt-5">
              <h2 className="mb-1 text-sm font-black uppercase tracking-wider text-muted-foreground">Sinopse</h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                {desc || descEn}
                {!desc && descEn && <span className="mt-1 block text-xs text-muted-foreground">(sinopse em inglês — tradução PT-BR em breve)</span>}
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={`/#/obra/${w.id}`}
              className="bg-brand-gradient rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110"
            >
              Abrir no OtakuVerse →
            </Link>
            {w.siteUrl && (
              <a
                href={w.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold transition hover:bg-accent"
              >
                Ficha na fonte oficial
              </a>
            )}
          </div>
        </div>
      </div>

      <footer className="mt-10 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
        Página informativa do OtakuVerse — não hospedamos, distribuímos ou vendemos conteúdo. Dados públicos de
        AniList, Kitsu e MangaUpdates; direitos das obras pertencem aos autores e editoras. As notas refletem as
        avaliações das fontes originais.
      </footer>
    </main>
  );
}
