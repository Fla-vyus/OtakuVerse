/**
 * Verificação: o filtro startDate_lesser/greater funciona? O que vem em cada janela?
 * Executar: bun scripts/verify-dates.ts
 */
const API = "https://graphql.anilist.co";
const Q = `
query ($type: MediaType, $country: CountryCode, $sort: [MediaSort],
       $sdGreater: FuzzyDateInt, $sdLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage hasNextPage }
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
  const first = json.data.Page.media[0];
  const last = json.data.Page.media[json.data.Page.media.length - 1];
  const fmt = (m: any) => m ? `${m.startDate.year}-${m.startDate.month ?? "?"}-${m.startDate.day ?? "?"} ${m.title.romaji.slice(0, 30)}` : "vazio";
  console.log(`${label}\n  total=${p.total} hasNext=${p.hasNextPage}\n  1º: ${fmt(first)}\n  últ: ${fmt(last)}`);
  await sleep(2200);
}

async function main() {
  await go("menores que 1941 (KR/JP manga, START_DATE_DESC)", { type: "MANGA", country: "JP", sort: ["START_DATE_DESC"], sdLesser: 19410510, page: 1, perPage: 5 });
  await go("2015 a 2018 JP", { type: "MANGA", country: "JP", sort: ["START_DATE_DESC"], sdGreater: 20150101, sdLesser: 20180101, page: 1, perPage: 5 });
  await go("página 2 de 2015-2018 (continuidade)", { type: "MANGA", country: "JP", sort: ["START_DATE_DESC"], sdGreater: 20150101, sdLesser: 20180101, page: 2, perPage: 5 });
}
main();
