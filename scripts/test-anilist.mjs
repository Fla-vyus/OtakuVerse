// Teste: fetch do AniList dentro do tsx vs node
const q = "query { Page(page: 2, perPage: 1) { pageInfo { total } } }";
const res = await fetch("https://graphql.anilist.co", {
  method: "POST",
  headers: { "Content-Type": "application/json", Accept: "application/json" },
  body: JSON.stringify({ query: q, variables: {} }),
});
const txt = await res.text();
console.log(`[${process.env.TSX_RUN ? "tsx" : "node"}] status=${res.status} body=${txt.slice(0, 150)}`);
