/**
 * Probe AniList: totais reais por recorte + teste de teto de profundidade + filtros de data.
 * Executar: bun scripts/probe-anilist.ts
 */
const API = "https://graphql.anilist.co";

const Q = `
query ($type: MediaType, $country: CountryCode, $format: MediaFormat, $sort: [MediaSort],
       $genre: [String], $tag: [String], $sdGreater: FuzzyDateInt, $sdLesser: FuzzyDateInt, $page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { total currentPage perPage hasNextPage lastPage }
    media(type: $type, countryOfOrigin: $country, format: $format, sort: $sort,
          genre_in: $genre, tag_in: $tag,
          startDate_greater: $sdGreater, startDate_lesser: $sdLesser, isAdult: false) { id }
  }
}`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gql(vars: Record<string, unknown>, label: string): Promise<any> {
  for (let a = 1; a <= 5; a++) {
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: Q, variables: vars }),
        signal: AbortSignal.timeout(30000),
      });
      if (res.status === 429 || res.status >= 500) {
        console.log(`[${label}] HTTP ${res.status}, aguardando...`);
        await sleep(45000);
        continue;
      }
      const json: any = await res.json();
      if (json.errors) return { error: JSON.stringify(json.errors).slice(0, 160) };
      return json.data.Page.pageInfo;
    } catch (e: any) {
      console.log(`[${label}] tentativa ${a}: ${String(e.message).slice(0, 100)}`);
      await sleep(4000 * a);
    }
  }
  return { error: "desistiu" };
}

async function probe(label: string, vars: Record<string, unknown>) {
  const info = await gql(vars, label);
  if ("error" in info) console.log(`${label.padEnd(34)} ERRO: ${info.error}`);
  else console.log(`${label.padEnd(34)} total=${info.total} lastPage=${info.lastPage}`);
  await sleep(2200);
}

async function main() {
  await probe("manga JP (todos)", { type: "MANGA", country: "JP", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga KR (todos)", { type: "MANGA", country: "KR", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga CN+TW (todos)", { type: "MANGA", country: "CN", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga JP NOVEL (LNs)", { type: "MANGA", country: "JP", format: "NOVEL", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga JP ONE_SHOT", { type: "MANGA", country: "JP", format: "ONE_SHOT", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("anime (todos)", { type: "ANIME", sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga JP pos-2018", { type: "MANGA", country: "JP", sort: "START_DATE_DESC", sdGreater: 20180101, page: 1, perPage: 1 });
  await probe("manga JP 2015-2018", { type: "MANGA", country: "JP", sort: "START_DATE_DESC", sdGreater: 20150101, sdLesser: 20180101, page: 1, perPage: 1 });
  await probe("manhwa KR pos-2016", { type: "MANGA", country: "KR", sort: "START_DATE_DESC", sdGreater: 20160101, page: 1, perPage: 1 });
  await probe("manga JP genre Ecchi", { type: "MANGA", country: "JP", genre: ["Ecchi"], sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  await probe("manga JP tag Villainess", { type: "MANGA", country: "JP", tag: ["Villainess"], sort: "POPULARITY_DESC", page: 1, perPage: 1 });
  // Teto de profundidade: página 101
  await probe("manga JP page=101 (teto?)", { type: "MANGA", country: "JP", sort: "POPULARITY_DESC", page: 101, perPage: 50 });
}
main();
