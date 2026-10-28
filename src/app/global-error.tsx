"use client";

// Última linha de defesa: se o PRÓPRIO error.tsx falhar (ou o root layout quebrar),
// este componente substitui a página inteira — nunca deixa o site branco/morto.
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body style={{ background: "#0b0b12", color: "#f4f4f6", fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 40 }}>🌸</div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>O OtakuVerse tropeçou — mas está de volta em um clique</h1>
          <p style={{ fontSize: 14, opacity: 0.7, maxWidth: 420, lineHeight: 1.6 }}>
            Falhou algo estrutural na renderização. Recarregue a página — catálogo, contas e
            biblioteca estão protegidos em backups independentes.
          </p>
          <button
            onClick={reset}
            style={{ background: "linear-gradient(135deg,#e255a2,#8b5cf6)", color: "#fff", border: 0, borderRadius: 12, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
          >
            Recarregar o site
          </button>
        </div>
      </body>
    </html>
  );
}
