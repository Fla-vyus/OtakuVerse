// Feed de notícias — isolamento total: nunca 500, nunca trava.
// Fontes: AniList → Kitsu (redundância) → catálogo SQL (sempre disponível).
// v4.0: candidatos SQL delimitados (top-90 por popularidade) — sem pool.
import { NextResponse } from "next/server";
import { selectCards, PUBLIC_GATE } from "@/lib/works-sql";
import { buildNews } from "@/lib/news";
import { cachedVolatile } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET() {
  let pool: Parameters<typeof buildNews>[0] = [];
  try {
    pool = await selectCards(`${PUBLIC_GATE} AND "cover" != ''`, [], `"popularity" DESC`, 90);
  } catch {
    pool = []; // buildNews degrada para as fontes ao vivo
  }
  const items = await buildNews(pool).catch(() => []);
  return cachedVolatile({ ok: true, items });
}
