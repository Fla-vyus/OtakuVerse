// Feed social ao vivo — reposts de fontes reais (Reddit/Kitsu) + matérias da redação.
// Isolamento total: nunca 500 travando a UI — último feed válido fica em memória (stale-on-error).
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { cachedJson } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

interface FeedRow {
  id: string; kind: string; source: string; handle: string | null;
  title: string | null; body: string; image: string | null; url: string | null;
  workId: string | null; tags: string | null; publishedAt: Date;
}

// último feed válido em memória — banco ocupado/instável NUNCA deixa a aba vazia
const g = globalThis as unknown as { __ovFeedStale?: { at: number; posts: any[] } };

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get("kind") ?? "all"; // all | official | editorial
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit") ?? 40), 1), 60);
  try {
    const rows: FeedRow[] = await db.feedPost.findMany({
      where: kind === "all" ? {} : { kind },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    const posts = rows.map((r) => ({
      id: r.id, kind: r.kind, source: r.source, handle: r.handle,
      title: r.title, body: r.body.length > 900 ? r.body.slice(0, 900).trimEnd() + "…" : r.body,
      image: r.image, url: r.url, workId: r.workId,
      tags: r.tags ? (JSON.parse(r.tags) as string[]).slice(0, 4) : [],
      at: r.publishedAt.toISOString(),
    }));
    g.__ovFeedStale = { at: Date.now(), posts };
    return cachedJson({ ok: true, posts }, 60); // 60s — feed vivo precisa renovar rápido, mas sem martelar o banco
  } catch {
    const stale = g.__ovFeedStale;
    if (stale) return cachedJson({ ok: true, posts: stale.posts, stale: true }, 10);
    return cachedJson({ ok: false, posts: [] }, 10);
  }
}
