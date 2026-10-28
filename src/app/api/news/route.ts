// Feed de notícias — isolamento total: nunca 500, nunca trava.
// Fontes: AniList → Kitsu (redundância) → catálogo local (sempre disponível).
import { NextResponse } from "next/server";
import { getAllWorks, peekStaleCache } from "@/lib/works";
import { buildNews } from "@/lib/news";
import type { WorkData } from "@/lib/types";
import { cachedVolatile } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET() {
  let pool: WorkData[] = [];
  try {
    pool = await getAllWorks();
  } catch {
    // banco ocupado/falhou → usa o último pool válido em memória (stale cache)
    pool = peekStaleCache()?.works ?? [];
  }
  const items = await buildNews(pool).catch(() => []);
  return cachedVolatile({ ok: true, items });
}
