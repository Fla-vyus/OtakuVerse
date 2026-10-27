// Segurança: hash de senha (scrypt nativo), sessões httpOnly, rate-limit em memória
import "server-only";
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const scrypt = promisify(_scrypt) as (p: string, s: Buffer, k: number, o: any) => Promise<Buffer>;

export const SESSION_COOKIE = "ov_session";
const SESSION_DAYS = 30;

// ---------- Senhas ----------
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const N = 16384, r = 8, p = 1;
  const key = await scrypt(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [alg, Ns, rs, ps, saltHex, keyHex] = stored.split("$");
    if (alg !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const key = await scrypt(password, salt, 64, { N: +Ns, r: +rs, p: +ps });
    const expected = Buffer.from(keyHex, "hex");
    return key.length === expected.length && timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

// ---------- Sessões ----------
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, ua?: string | null): Promise<string> {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.session.create({ data: { token: sha256(raw), userId, expiresAt, ua: ua?.slice(0, 180) ?? null } });
  // limpeza de sessões expiradas (10% de chance por login para espalhar custo)
  if (Math.random() < 0.1) {
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});
  }
  return raw;
}

export async function getSessionUser(req?: Request) {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const row = await db.session.findUnique({ where: { token: sha256(raw) }, include: { user: true } });
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) {
    db.session.delete({ where: { id: row.id } }).catch(() => {});
    return null;
  }
  // renovação deslizante (1x/dia)
  if (Date.now() - row.createdAt.getTime() > 86400000 && row.expiresAt.getTime() - Date.now() < 15 * 86400000) {
    db.session.update({ where: { id: row.id }, data: { expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000) } }).catch(() => {});
  }
  return row.user;
}

export async function destroySession() {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (raw) {
    await db.session.deleteMany({ where: { token: sha256(raw) } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

export function sessionCookie(raw: string) {
  return {
    name: SESSION_COOKIE,
    value: raw,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false, // funciona em http (preview) e https
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  };
}

// ---------- Rate limit (bucket em memória por IP) ----------
const buckets = new Map<string, { n: number; reset: number }>();

export function rateLimit(req: Request, scope: string, max: number, windowMs: number): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local";
  const key = `${scope}:${ip}`;
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.reset < now) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  b.n++;
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  }
  return b.n <= max;
}

// ---------- Validação de cadastro ----------
export function validateRegistration(email: string, username: string, password: string, accepted: boolean): string | null {
  if (!accepted) return "É preciso aceitar os Termos de Uso e a Política de Privacidade.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "E-mail inválido.";
  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) return "Usuário: 3–20 caracteres (letras minúsculas, números, . _ -).";
  if (password.length < 8) return "Senha precisa de pelo menos 8 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Senha precisa conter letras e números.";
  return null;
}
