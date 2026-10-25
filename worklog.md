# Worklog — Projeto OtakuVerse

---
Task ID: 1
Agent: main (Z.ai)
Task: Construir portal web de mangás/manhwas/LNs/animes com IA (Type 3 — Next.js 16 fullstack), a partir do pedido de usuário fã de ecchi/arte/história que achava tudo saturado.

Work Log:
- Carregadas skills fullstack-dev e LLM; ambiente inicializado via script oficial.
- Testes de rede: api.jikan.moe (MAL) BLOQUEADA; graphql.anilist.co OK → AniList escolhido como fonte de dados reais.
- Prisma schema `Work` (SQLite): títulos, sinopse + sinopsePT (cache IA), capas/banners, gêneros, tags JSON (com rank), autores JSON, extLinks JSON, scores, capítulos/volumes/eps, datas, idiomas, lastUpdate, nextEpisode (anime).
- scripts/seed-works.ts: 11 queries AniList (top mangás JP, manhwas KR, manhuas CN, LNs, tag Nudity p/ sensorial, lançamentos 2024+, animes trending/populares, obras-primas) → 200 obras reais no banco.
- Bug corrigido #1: tag "Ecchi" removida da AniList em rework 2024/25 → substituída por "Nudity" (isAdult:false).
- Bug corrigido #2: campo `type` faltava no GraphQL fields → animes eram salvos como "manga". Adicionado `type` ao fields + update branch; re-seed corrigiu tipos (50 anime / 69 manga / 44 manhwa / 25 LN / 12 manhua).
- Bug corrigido #3: AniList search quebra com `type: null` → query dinâmica com/sem type.
- APIs: /api/works (filtros tipo/gênero/tag/status/idioma/ordenação + facets), /api/works/[id] (obra + parecidas por overlap de tags + obras do autor), /api/discover (busca AO VIVO na AniList com upsert), /api/ai/chat (Aoi: heurística de sinônimos PT→tags/genres, catálogo compacto, marcador [#id]), /api/ai/analyze (análise estruturada PT-BR + tradução de sinopse cacheada), /api/ai/synopsis.
- UI (SPA em rota única /): store zustand + hash-routing (#/, #/explorar, #/obra/{id}, #/assistente) com voltar/avançar funcionando; tema dark premium violeta/rosa; Home (hero carrossel auto-rotativo com banners, chips de categoria, 8 seções, banner IA); Explorar (busca, 5 selects, chips ativos, paginação, busca ao vivo AniList); Detalhe (banner+capa, 6 stat boxes, 4 abas: Visão geral com idiomas/sinopse/tags clicáveis, Onde ler & links com portais oficiais+comunidade+radar externo MAL/X/MangaUpdates/Google Notícias, Parecidas/autor, Análise IA); Assistente (chat com sugestões, pills clicáveis "ver obra {id}").
- Bug corrigido #4: chave React duplicada em extLinks (MangaPlus 2 idiomas) → key com índice.
- Melhoria: mainAuthors() prioriza papéis de autor real (Original Creator/Story & Art) sobre ADR Director.
- Verificação Agent Browser: desktop (1440px) e mobile (390px); carrossel, cards, 4 abas do detalhe, Análise IA gerada com sucesso, chat Aoi com pills funcionando, explorar com deep-link e filtros, footer fixo, console limpo, lint limpo.

Stage Summary:
- Site completo e verificado: OtakuVerse — portal com 200 obras reais, IA de recomendação (Aoi), análise IA por obra, tradução PT-BR de sinopse, busca ao vivo AniList, estimativa de próximo capítulo (semanal p/ mangás, data real p/ animes em exibição), idiomas disponíveis (original/oficial/provável/streaming), links para MAL/X/MangaUpdates/Google Notícias/portais oficiais.
- Arquivos-chave: prisma/schema.prisma, scripts/seed-works.ts, src/lib/{types,works,anilist,db}.ts, src/app/api/**, src/components/portal/**, src/app/{page,layout,globals.css}.
- Prints de verificação em /home/z/my-project/worklogs/*.png
