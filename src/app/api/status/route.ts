// Status público do site: catálogo, última atualização e SAÚDE DOS DADOS
// (backups, snapshots git-safe, integridade) — visível no rodapé/perfil.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const g = globalThis as unknown as { __statusCache?: { at: number; data: any } };

function backupInfo() {
  try {
    const dir = path.join(process.cwd(), "db", "backups");
    if (!existsSync(dir)) return { count: 0, lastAt: null as string | null };
    const files = readdirSync(dir).filter((f) => f.endsWith(".db")).sort().reverse();
    const last = files[0] ? statSync(path.join(dir, files[0])).mtime.toISOString() : null;
    return { count: files.length, lastAt: last };
  } catch {
    return { count: 0, lastAt: null as string | null };
  }
}

function snapshotInfo() {
  try {
    const m = path.join(process.cwd(), "data", "manifest.json");
    if (!existsSync(m)) return { at: null as string | null, verified: false };
    const manifest = JSON.parse(readFileSync(m, "utf8"));
    return { at: manifest.generatedAt ?? null, verified: true };
  } catch {
    return { at: null as string | null, verified: false };
  }
}

export async function GET() {
  if (g.__statusCache && Date.now() - g.__statusCache.at < 60_000) {
    return NextResponse.json({ ok: true, ...g.__statusCache.data });
  }
  try {
    const [total, publicTotal, lastCron, users, syncMeta] = await Promise.all([
      db.work.count({ where: { type: { not: "drama" } } }),
      db.work.count({ where: { type: { not: "drama" }, isAdult: false } }),
      db.eventLog.findFirst({ where: { kind: "cron_refresh" }, orderBy: { at: "desc" } }),
      db.user.count().catch(() => 0),
      db.syncMeta.findUnique({ where: { id: "anilist" } }).catch(() => null),
    ]);
    const data = {
      total,
      // público = catálogo navegável sem login (zona +18 não conta — coerente com home/Aoi)
      publicTotal,
      lastRefreshAt: lastCron?.at?.toISOString() ?? null,
      // durabilidade
      users,
      backup: backupInfo(),
      snapshot: snapshotInfo(),
      dbSizeMB: existsSync(process.cwd() + "/db/custom.db")
        ? Math.round(statSync(process.cwd() + "/db/custom.db").size / 1048576 * 10) / 10
        : null,
      lastSync: syncMeta?.lastSync ? new Date(syncMeta.lastSync * 1000).toISOString() : null,
    };
    g.__statusCache = { at: Date.now(), data };
    return NextResponse.json({ ok: true, ...data });
  } catch {
    return NextResponse.json({ ok: true, total: null, lastRefreshAt: null });
  }
}
