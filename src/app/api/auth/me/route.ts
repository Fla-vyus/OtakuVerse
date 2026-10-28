import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let user;
  try {
    user = await getSessionUser();
  } catch {
    // isolamento: sessão não consultável = tratar como deslogado (nunca 500)
    return NextResponse.json({ ok: true, user: null });
  }
  if (!user) return NextResponse.json({ ok: true, user: null });
  try {
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
  } catch {
    // isolamento: contagens falharam — responde o usuário sem nuvem (nunca 500)
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, avatarColor: user.avatarColor, bio: user.bio, adultMode: user.adultMode, settings: user.settings, createdAt: user.createdAt, lastLoginAt: user.lastLoginAt }, cloud: { libCount: null, lastSyncAt: null } });
  }
}
