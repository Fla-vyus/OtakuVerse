const UAS = [
  "OtakuVerseBot/2.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "curl/8.5.0",
  "OtakuVerse/2.0 (https://otakuverse.app; contato@otakuverse.app)",
];

async function t(ua: string) {
  try {
    const res = await fetch("https://pt.wikipedia.org/api/rest_v1/page/summary/Squid_Game", {
      headers: { Accept: "application/json", "User-Agent": ua },
      signal: AbortSignal.timeout(10000),
    });
    const txt = await res.text();
    const isJson = txt.trim().startsWith("{");
    console.log(JSON.stringify(ua).slice(0, 60), "=>", res.status, isJson ? "JSON OK" : "HTML(" + txt.slice(0, 60).replace(/\n/g, "") + ")");
  } catch (e: any) {
    console.log(JSON.stringify(ua).slice(0, 60), "ERR", String(e).slice(0, 60));
  }
}

(async () => {
  for (const ua of UAS) await t(ua);
})();
