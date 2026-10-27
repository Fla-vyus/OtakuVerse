// Camada de segurança do OtakuVerse:
// - Rate limiting por IP/usuário (janela deslizante em memória)
// - Lockout progressivo de login (anti brute-force)
// - Política de senha forte + medidor de força
// - Sanitização básica de entrada
// Nota: em um único processo Node (standalone), Map em memória é suficiente e
// rápido; chaves antigas são podadas automaticamente a cada chamada.

interface Bucket {
  hits: number[]; // timestamps (ms) dentro da janela
}

const buckets = new Map<string, Bucket>();
const LOGIN_FAILS = new Map<string, { count: number; until: number; first: number }>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  const cutoff = now - 60 * 60_000;
  for (const [k, b] of buckets) {
    b.hits = b.hits.filter((t) => t > cutoff);
    if (b.hits.length === 0) buckets.delete(k);
  }
  for (const [k, l] of LOGIN_FAILS) {
    if (l.until < now && l.first < cutoff) LOGIN_FAILS.delete(k);
  }
}

/** Janela deslizante: true = permitido; false = excedeu o limite */
export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  sweep(now);
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => t > now - windowMs);
  if (b.hits.length >= limit) {
    const retryAfter = Math.ceil((b.hits[0] + windowMs - now) / 1000);
    buckets.set(key, b);
    return { ok: false, retryAfter };
  }
  b.hits.push(now);
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

/** Resposta 429 padronizada */
export function tooMany(retryAfter: number, msg = "Muitas requisições. Tente novamente em instantes.") {
  return Response.json(
    { ok: false, error: msg },
    { status: 429, headers: { "Retry-After": String(Math.max(1, retryAfter)) } }
  );
}

// ---------- Login lockout ----------

const LOCK_THRESHOLD = 6;
const LOCK_WINDOW = 15 * 60_000; // 15 min

export function loginLocked(key: string): boolean {
  const l = LOGIN_FAILS.get(key);
  return !!l && l.until > Date.now();
}

export function loginFail(key: string) {
  const now = Date.now();
  const l = LOGIN_FAILS.get(key) ?? { count: 0, until: 0, first: now };
  if (now - l.first > LOCK_WINDOW) {
    l.count = 0;
    l.first = now;
  }
  l.count++;
  if (l.count >= LOCK_THRESHOLD) l.until = now + LOCK_WINDOW;
  LOGIN_FAILS.set(key, l);
}

export function loginSuccess(key: string) {
  LOGIN_FAILS.delete(key);
}

// ---------- Política de senha ----------

export interface PasswordVerdict {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4; // 0 crítica · 4 excelente
  label: string;
  problems: string[];
}

export function checkPassword(pw: string): PasswordVerdict {
  const problems: string[] = [];
  if (pw.length < 8) problems.push("use ao menos 8 caracteres");
  if (!/[a-zA-Z]/.test(pw)) problems.push("inclua letras");
  if (!/[0-9]/.test(pw)) problems.push("inclua números");

  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw)) score = 0; // tudo igual
  if (["12345678", "password", "senha123", "123456789", "qwerty123", "abc12345"].includes(pw.toLowerCase())) score = 0;

  const labels = ["crítica", "fraca", "razoável", "forte", "excelente"];
  const s = Math.max(0, Math.min(4, problems.length > 0 ? Math.min(score, 1) : score)) as 0 | 1 | 2 | 3 | 4;
  return { ok: problems.length === 0, score: s, label: labels[s], problems };
}

// ---------- Sanitização ----------

export function cleanText(v: unknown, max: number): string {
  return String(v ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, max);
}

// ---------- Helpers de requisição ----------

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

export function isSecureReq(req: Request): boolean {
  const proto = req.headers.get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}
