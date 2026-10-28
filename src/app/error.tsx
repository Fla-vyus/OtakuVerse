"use client";

// Error boundary raiz do App Router: se QUALQUER parte da UI quebrar, o usuário
// vê esta tela amigável com botão de tentar de novo — nunca uma tela branca morta.
import { useEffect } from "react";
import { RefreshCw, Home } from "lucide-react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // log do erro (aparece no dev.log / observabilidade do servidor)
    console.error("[error-boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="bg-brand-gradient flex h-14 w-14 items-center justify-center rounded-2xl text-2xl text-white shadow-lg">✕</div>
      <h2 className="text-lg font-black">Algo desligou do lado errado da tela</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Um pedaço do site travou, mas o resto continua de pé. Tente renderizar de novo —
        seus dados estão salvos na nuvem e no cofre.
      </p>
      <div className="flex gap-2">
        <button
          onClick={reset}
          className="bg-brand-gradient flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white"
        >
          <RefreshCw className="h-4 w-4" /> Tentar de novo
        </button>
        <a
          href="#/"
          className="flex h-10 items-center gap-2 rounded-xl border border-border px-5 text-sm font-bold transition hover:bg-accent"
        >
          <Home className="h-4 w-4" /> Voltar ao início
        </a>
      </div>
    </div>
  );
}
