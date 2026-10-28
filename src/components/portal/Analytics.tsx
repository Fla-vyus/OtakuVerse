"use client";

// Analytics GRATUITO do OtakuVerse — dois motores, ambos com camada gratuita:
//   · Google Analytics 4     → NEXT_PUBLIC_GA_ID       (ex.: "G-XXXXXXXXXX")
//   · Cloudflare Web Analytics → NEXT_PUBLIC_CF_BEACON (token do beacon; sem cookies!)
// Nenhum configurado = nenhum script carregado (site 100% limpo enquanto não medimos).
// Cloudflare Web Analytics é privacy-first e não exige banner de cookies; o GA4
// (com anúncios personalizados no futuro) exigirá consentimento LGPD — o banner
// entra junto com o AdSense. Por isso o CF é o "ligar e medir" recomendado.

import Script from "next/script";

export default function Analytics() {
  const GA_ID = process.env.NEXT_PUBLIC_GA_ID ?? "";
  const CF_BEACON = process.env.NEXT_PUBLIC_CF_BEACON ?? "";

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ov-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${GA_ID}',{anonymize_ip:true});`}
          </Script>
        </>
      )}
      {CF_BEACON && (
        <Script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={JSON.stringify({ token: CF_BEACON })}
          strategy="afterInteractive"
        />
      )}
    </>
  );
}
