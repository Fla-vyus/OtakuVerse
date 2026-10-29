// Auto-atualização do catálogo: refresca tendências/estimativas e expande o catálogo
// em background. Chamado pelo instrumentation (a cada 30 min) ou manualmente.
import { NextRequest, NextResponse } from "next/server";
import { anilistFetch, toWorkRow, SEARCH_FIELDS } from "@/lib/anilist";
import { db } from "@/lib/db";
import { classify } from "@/lib/works";
import { invalidateWorksCache } from "@/lib/works";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const g = globalThis as unknown as { __cronRunning?: boolean; __cronLast?: number };

export async function doRefresh(): Promise<{ refreshed: number; expanded: number }> {
  if (g.__cronRunning) return { refreshed: 0, expanded: 0 };
  g.__cronRunning = true;
  let refreshed = 0;
  let expanded = 0;
  const { flight } = await import("@/lib/flightlog");
  const t0 = Date.now();
  flight("refresh-start", { rssMB: Math.round(process.memoryUsage().rss / 1048576) });
  try {
    // 1) refresca o que está em tendência agora (hype real + next episodes)
    const data = await anilistFetch(
      `query { Page(perPage: 50) { media(sort: TRENDING_DESC, isAdult: false) { ${SEARCH_FIELDS} } } }`,
      {}
    );
    const media: any[] = data?.Page?.media ?? [];
    for (const m of media) {
      const row = toWorkRow(m);
      const cls = classify(m);
      await db.work.upsert({
        where: { id: String(m.id) },
        create: { ...row, ...cls },
        update: { ...row, classification: cls.classification, adultTags: cls.adultTags, spicy: cls.spicy },
      });
      refreshed++;
    }

    // 2) expande o catálogo: próxima página de popularidade por tipo que ainda não baixamos
    const existing = await db.work.findMany({ select: { id: true } });
    const have = new Set(existing.map((r) => r.id));
    const targets = [
      { type: "MANGA", country: "JP", format: null as string | null },
      { type: "MANGA", country: "KR", format: null },
      { type: "ANIME", country: "JP", format: null },
      { type: "MANGA", country: "JP", format: "NOVEL" },
    ];
    for (const t of targets) {
      for (let page = 1; page <= 8; page++) {
        const q = await anilistFetch(
          `query ($p: Int, $type: MediaType, $country: CountryCode, $format: MediaFormat) {
            Page(page: $p, perPage: 50) {
              media(type: $type, countryOfOrigin: $country, format: $format, sort: POPULARITY_DESC, isAdult: false) { ${SEARCH_FIELDS} }
            }
          }`,
          { p: page, type: t.type, country: t.country, format: t.format ?? undefined }
        );
        const list: any[] = q?.Page?.media ?? [];
        if (!list.length) break;
        const fresh = list.filter((m) => !have.has(String(m.id)));
        for (const m of fresh) {
          const row = toWorkRow(m);
          const cls = classify(m);
          await db.work.upsert({ where: { id: String(m.id) }, create: { ...row, ...cls }, update: row });
        }
        expanded += fresh.length;
        // se a página já está toda no banco, não adianta continuar neste alvo
        if (fresh.length < 5) break;
        await new Promise((r) => setTimeout(r, 2200)); // respeita rate limit AniList
      }
    }
    // v3.9.4 — invalidação CONDICIONAL: o rebuild do pool é o pico de RAM da
    // instância publicada (puxa milhares de rows do Turso + parse de objetos).
    // Invalidar a cada ciclo forçava um rebuild EXTRA a cada 30min mesmo quando
    // nada cresceu. O pool tem TTL com stale-while-revalidate — updates de
    // tendência (refreshed) aparecem na revalidação natural; só um catálogo que
    // CRESCOU (expanded>0) justifica o pico imediato.
    if (expanded > 0) invalidateWorksCache();
    g.__cronLast = Date.now();
    await db.eventLog.create({ data: { kind: "cron_refresh", payload: JSON.stringify({ refreshed, expanded }) } });
    flight("refresh-end", { refreshed, expanded, ms: Date.now() - t0, rssMB: Math.round(process.memoryUsage().rss / 1048576) });
  } catch (e) {
    console.error("cron refresh error:", e);
    flight("refresh-error", { msg: String((e as Error)?.message ?? e).slice(0, 200), ms: Date.now() - t0 });
  } finally {
    g.__cronRunning = false;
  }
  return { refreshed, expanded };
}

export async function GET(req: NextRequest) {
  // TRANCADO: exige chave (definida no .env como CRON_KEY). A chamada interna do
  // instrumentation.ts usa doRefresh() direto e não passa por aqui.
  // v3.8 — aceita query (?key=) OU Authorization: Bearer (Vercel Cron).
  const key =
    req.nextUrl.searchParams.get("key") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const expected = process.env.CRON_KEY ?? process.env.CRON_SECRET;
  if (!expected || key !== expected) {
    return NextResponse.json({ ok: false, error: "Chave inválida" }, { status: 403 });
  }
  const res = await doRefresh();
  return NextResponse.json({ ok: true, ...res, at: Date.now() });
}
