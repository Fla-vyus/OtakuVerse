/**
 * Verificação v2: START_DATE põe nulls no fim? Página 100 vs nulls.
 * Executar: bun scripts/verify-dates2.ts
 */
const API = "https://graphql.anilist.co";
const Q = `
query ($type: MediaType, $country: CountryCode, $sort: [MediaSort],
       $sdGreater: FuzzyDateInt, $sdLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total hasNextPage }
    media(type: $type, countryOfOrigin: $country, sort: $sort,
          startDate_greater: $sdGreater, startDate_lesser: $sdLesser, isAdult: false) {
      id startDate { year month day } title { romaji }
    }
  }
}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function go(label: string, vars: Record<string, unknown>) {
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query: Q, variables: vars }),
    signal: AbortSignal.timeout(30000),
  });
  const json: any = await res.json();
  if (json.errors) { console.log(`${label}: ERRO ${JSON.stringify(json.errors).slice(0, 120)}`); return; }
  const p = json.data.Page.pageInfo;
  const rows = json.data.Page.media;
  const fmt = (m: any) => m ? `${m.startDate?.year ?? "NULL"}-${m.startDate?.month ?? "?"} ${m.title.romaji.slice(0, 28)}` : "vazio";
  console.log(`${label} (total=${p.total})`);
  console.log(`  1º: ${fmt(rows[0])}`);
  console.log(`  últ: ${fmt(rows[rows.length - 1])}`);
  const nulls = rows.filter((m: any) => !m.startDate?.year).length;
  console.log(`  nulls nesta página: ${nulls}/${rows.length}`);
  await sleep(2200);
}

async function main() {
  // Janela pequena real: 1941-1945 (guerra, poucas obras) — se ASC, 1º = mais antigo real
  await go("1941-1945 ASC página 1", { type: "MANGA", country: "JP", sort: ["START_DATE"], sdGreater: 19410101, sdLesser: 19460101, page: 1, perPage: 50 });
  // Janela profunda: 2015-2018 — página 1 deve começar no mais antigo (2015)
  await go("2015-2018 ASC página 1", { type: "MANGA", country: "JP", sort: ["START_DATE"], sdGreater: 20150101, sdLesser: 20180101, page: 1, perPage: 50 });
  // Página 100 da janela profunda — permitido? E o que aparece (2018 ou nulls)?
  await go("2015-2018 ASC página 100 (teto)", { type: "MANGA", country: "JP", sort: ["START_DATE"], sdGreater: 20150101, sdLesser: 20180101, page: 100, perPage: 50 });
}
main();
