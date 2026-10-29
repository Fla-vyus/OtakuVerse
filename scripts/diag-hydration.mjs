// Diagnóstico de hidratação: captura pageerror, console, requestfailed
import { createRequire } from "module";
const require = createRequire("/home/z/.npm-global/lib/node_modules/");
const { chromium } = require("playwright");

const URL = process.argv[2] || "http://127.0.0.1:3000/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const erros = [];
page.on("pageerror", (e) => erros.push("[PAGEERROR] " + (e.stack || e.message).slice(0, 1500)));
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()))
    erros.push("[CONSOLE." + m.type().toUpperCase() + "] " + m.text().slice(0, 800));
});
page.on("requestfailed", (r) =>
  erros.push("[REQ-FAIL] " + r.url().slice(0, 150) + " → " + r.failure()?.errorText)
);
page.on("response", (r) => {
  if (r.status() >= 400) erros.push("[HTTP " + r.status() + "] " + r.url().slice(0, 150));
});

await page.goto(URL, { waitUntil: "networkidle", timeout: 90_000 }).catch((e) =>
  erros.push("[GOTO] " + e.message)
);
await page.waitForTimeout(8_000);

const estado = await page.evaluate(() => ({
  imgs: document.querySelectorAll("img").length,
  cards: document.querySelectorAll('a[href*="/obra/"]').length,
  buscando: document.querySelector("main")?.textContent?.includes("Buscando os melhores") ?? null,
  reactRoots: Object.keys(window).filter((k) => k.startsWith("__react")).length,
}));

console.log("=== ESTADO DO DOM ===");
console.log(JSON.stringify(estado, null, 2));
console.log("=== ERROS CAPTURADOS (" + erros.length + ") ===");
for (const e of erros.slice(0, 25)) console.log(e, "\n");

await browser.close();
