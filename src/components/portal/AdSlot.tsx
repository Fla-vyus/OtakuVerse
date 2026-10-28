"use client";

// Slot de anúncios do OtakuVerse — REGRA ABSOLUTA: anúncio SÓ em página classificada
// como safe, e JAMAIS com o modo +18 ativo (conformidade Google AdSense + isolamento
// da zona adulta pedido pelo dono do site).
//
// Portões (todos precisam passar):
//   1. NEXT_PUBLIC_ADSENSE_CLIENT configurado — sem credencial, renderiza NADA
//      (nem caixa vazia: zero impacto no layout e no CLS enquanto não monetiza);
//   2. modo adulto do perfil DESLIGADO (user.adultMode);
//   3. view atual fora da zona +18 (view !== "adult");
//   4. página de obra: apenas classification === "safe" (suggestive/ecchi NÃO recebe anúncio);
//   5. views gerais monetizáveis: home/notícias/vendas/revistas/calendário/streaming —
//      explore fica de fora de propósito (mix de capas suggestive no resultado).
//
// O script do AdSense carrega UMA vez, lazy (idle), só quando existe 1º slot ativo —
// a home instantânea nunca espera anúncio.

import { useEffect, useRef, useState } from "react";
import { usePortal } from "./store";

const ADS_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
const SAFE_VIEWS = new Set(["home", "news", "sales", "magazines", "calendar", "streaming", "detail", "rankings"]);

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    __ovAdsLoaded?: boolean;
  }
}

/** Injeta o script do AdSense 1× por sessão de página — só após idle, nunca no caminho crítico. */
function ensureScript(client: string) {
  if (typeof window === "undefined" || window.__ovAdsLoaded) return;
  window.__ovAdsLoaded = true;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);
}

export default function AdSlot({
  workClass,
  slotId,
  label = "Publicidade",
}: {
  /** classificação da obra quando o slot vive numa página de detalhe */
  workClass?: string;
  /** id lógico do slot (ex.: "detail-sidebar", "home-mid") */
  slotId: string;
  label?: string;
}) {
  const view = usePortal((s) => s.view);
  const adultMode = usePortal((s) => !!s.user?.adultMode);
  const ref = useRef<HTMLModElement | null>(null);
  const [armed, setArmed] = useState(false);

  const allowed =
    ADS_CLIENT !== "" &&
    !adultMode &&
    view !== "adult" &&
    SAFE_VIEWS.has(view) &&
    (view !== "detail" || workClass === "safe");

  useEffect(() => {
    if (!allowed) return;
    const idle = "requestIdleCallback" in window
      ? window.requestIdleCallback(() => setArmed(true), { timeout: 2500 })
      : (setTimeout(() => setArmed(true), 1200) as unknown as number);
    return () => {
      if ("cancelIdleCallback" in window && typeof idle === "number") window.cancelIdleCallback(idle);
      else clearTimeout(idle);
    };
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !armed) return;
    ensureScript(ADS_CLIENT);
    const t = setTimeout(() => {
      try {
        window.adsbygoogle = window.adsbygoogle ?? [];
        window.adsbygoogle.push({});
      } catch {}
    }, 50);
    return () => clearTimeout(t);
  }, [allowed, armed]);

  if (!allowed) return null;

  return (
    <div className="ov-ad-slot my-4 overflow-hidden rounded-2xl border border-border/60 bg-card/40">
      <p className="px-3 pt-2 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">{label}</p>
      <ins
        ref={ref}
        className="adsbygoogle block"
        style={{ display: "block", minHeight: 100 }}
        data-ad-client={ADS_CLIENT}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
