// Proxy de segurança do OtakuVerse (convenção Next 16 — substitui middleware):
// aplica headers de proteção em TODAS as respostas: CSP, HSTS, anti-clickjacking,
// nosniff, referrer e permissions policy.
import { NextResponse, type NextRequest } from "next/server";

export default function proxy(_req: NextRequest) {
  const res = NextResponse.next();
  const h = res.headers;

  // Content-Security-Policy: mantém o site fechado (só self + inline necessário
  // para hidratação/estilos do Next). Imagens externas passam pelo proxy /api/img.
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
  h.set("Content-Security-Policy", csp);
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  // HSTS: o gateway serve HTTPS; forçado por 1 ano (inclui subdomínios)
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
