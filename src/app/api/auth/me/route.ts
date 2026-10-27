import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: true, user: null });
  const [libCount, lastSync] = await Promise.all([
    db.libraryItem.count({ where: { userId: user.id } }),
    db.eventLog.findFirst({ where: { userId: user.id, kind: { in: ["sync_push", "sync_pull"] } }, orderBy: { at: "desc" } }),
  ]);
  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarColor: user.avatarColor,
      bio: user.bio,
      adultMode: user.adultMode,
      settings: user.settings,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    cloud: { libCount, lastSyncAt: lastSync?.at ?? null },
  });
}
