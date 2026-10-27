import { NextRequest, NextResponse } from "next/server";
import { forYouPage } from "@/lib/works";

export const dynamic = "force-dynamic";

interface Body {
  taste?: { types?: string[]; genres?: string[]; tags?: string[]; spice?: number; vibe?: "leve" | "equilibrado" | "pesado" };
  favorites?: string[];
  lists?: Record<string, { status: string; rating?: number; addedAt: number }>;
  surprise?: boolean;
  page?: number;
  adult?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: Body = await req.json().catch(() => ({}));
    const taste = {
      types: body.taste?.types ?? [],
      genres: body.taste?.genres ?? [],
      tags: body.taste?.tags ?? [],
      spice: body.taste?.spice ?? 1,
      vibe: body.taste?.vibe ?? "equilibrado",
    };
    const favorites = Array.isArray(body.favorites) ? body.favorites.slice(0, 30) : [];
    const lists = body.lists ?? {};
    const adult = body.adult === "show" || body.adult === "only" ? body.adult : "hide";
    const { items, total } = await forYouPage(taste, favorites, lists, {
      surprise: !!body.surprise,
      page: Number(body.page ?? 1),
      perPage: 18,
      adult,
    });
    return NextResponse.json({ ok: true, items, total });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
