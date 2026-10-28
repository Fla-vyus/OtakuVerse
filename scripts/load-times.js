// Medição real de tempo-para-conteúdo (meta <2s) — sessão única, sequencial.
// Para cada view: navega com cache de página novo, faz polling do 1º conteúdo real.
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

function sh(cmd) { return execSync(cmd, { stdio: "pipe" }).toString(); }

async function measure(hash, label) {
  // volta pra home primeiro (mesma sessão), depois navega
  sh(`agent-browser eval "location.hash='#/'; 'ok'"`);
  await new Promise((r) => setTimeout(r, 700));
  const t0 = Date.now();
  sh(`agent-browser eval "location.hash='${hash}'; 'ok'"`);
  let elapsed = null;
  // polling a cada 60ms até conteúdo real da view aparecer
  const sel = {
    "#/explorar": "input[placeholder*=Buscar]",
    "#/noticias": "h1",
    "#/calendario": "h1",
    "#/streaming": "h1",
    "#/vendas": "h1",
    "#/revistas": "h1",
  }[hash];
  for (let i = 0; i < 100; i++) {
    try {
      const out = sh(`agent-browser eval "var el=document.querySelector('${sel}'); el ? (el.getBoundingClientRect().height>0?'YES':'NO') : 'NO'"`);
      if (out.includes("YES")) { elapsed = Date.now() - t0; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`${label}: conteúdo em ${elapsed}ms ${elapsed < 2000 ? "✓" : "✗ >2s!"}`);
}

(async () => {
  // 1ª abertura: página inteira do zero (recarga real)
  let t0 = Date.now();
  sh(`agent-browser open "http://localhost:3000/"`);
  for (let i = 0; i < 150; i++) {
    try {
      const out = sh(`agent-browser eval "document.querySelectorAll('img').length > 10 ? 'YES' : 'NO'"`);
      if (out.includes("YES")) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 60));
  }
  console.log(`ABRIR O SITE (recarga completa): conteúdo em ${Date.now() - t0}ms ${Date.now() - t0 < 2000 ? "✓" : "✗ >2s!"}`);

  await measure("#/explorar", "EXPLORAR (navegação interna)");
  await measure("#/noticias", "NOTÍCIAS (navegação interna)");
  await measure("#/calendario", "CALENDÁRIO (navegação interna)");
  await measure("#/streaming", "STREAMING (navegação interna)");
  await measure("#/vendas", "VENDAS (navegação interna)");
  await measure("#/revistas", "REVISTAS (navegação interna)");

  // recarga completa de cada rota direta (cold open de cada "opção")
  for (const [h, label] of [["#/explorar", "EXPLORAR"], ["#/calendario", "CALENDÁRIO"], ["#/streaming", "STREAMING"]]) {
    t0 = Date.now();
    sh(`agent-browser open "http://localhost:3000/${h}"`);
    for (let i = 0; i < 150; i++) {
      try {
        const out = sh(`agent-browser eval "document.querySelectorAll('img').length > 8 ? 'YES' : 'NO'"`);
        if (out.includes("YES")) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 60));
    }
    console.log(`${label} (abertura direta/recarga): conteúdo em ${Date.now() - t0}ms ${Date.now() - t0 < 2000 ? "✓" : "✗ >2s!"}`);
  }
})();
