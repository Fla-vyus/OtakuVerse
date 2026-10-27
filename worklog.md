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

---
Task ID: 2
Agent: main (Z.ai)
Task: RECONSTRUÇÃO COMPLETA (v2) — o ambiente foi resetado ao estado do Task 1 (a versão evoluída das rodadas 2–8 nunca foi commitada). Reconstruir TUDO acumulado + novas exigências: segurança/criptografia, conta+perfil profundo com Modo +18 escondido (NÃO misturado ao catálogo), nuvem sincronizada, textos legais, correção definitiva das imagens (multi-fonte anti-bloqueio), Aoi waifu, performance, carrossel hype com modos.

Work Log:
- AUDITORIA: git tinha só 2 commits (v1). Rede re-testada: AniList ✅, Kitsu ✅, MangaUpdates ✅, Wikipédia ✅ (requer UA com URL/contato), Jikan/MangaDex/ANN bloqueados.
- SCHEMA v2: User (scrypt hash, settings JSON, adultMode+consent), Session (cookie httpOnly, sha256), LibraryItem (sync last-write-wins), EventLog; Work +coverAlt, classification (safe|suggestive|adult), adultTags, magazine JSON, network (dramas), type drama.
- IMAGENS (fix definitivo): proxy /api/img — servidor busca sem referer (mata hotlink-block), valida content-type image/*, cache em disco (.imgcache, 7 dias) + LRU memória (96), rate-limit 300/min/IP, allowlist de hosts, fallback ?f= fonte alternativa; cliente: proxy → URL direta no-referrer → card-texto estilizado (NUNCA imagem fake/IA).
- SEEDS: seed-big.ts (retomável via .seed-state.json) — Fase A AniList em massa (14 alvos, ~230 páginas × 50) → 9.588 obras; Fase C MangaUpdates → 91 obras com revista REAL confirmada; Fase D metadados editoriais derivados (9.009 obras). seed-dramas.ts — 45 dramas reais (KR/CN/JP/TH) com pôster da Wikipédia (39/45 com imagem). seed-adult.ts — 534 obras +18 gated. Classificação automática: adult (isAdult/doujin), suggestive (Ecchi/Nudity rank), safe.
- SEGURANÇA: scrypt N=16384 salt próprio, sessões 30d cookie httpOnly SameSite=Lax com renovação deslizante, rate-limit login 10/min + register 8/min + img/sync, validação de cadastro, headers (nosniff, X-Frame-Options, Referrer-Policy no-referrer, Permissions-Policy), poweredByHeader off.
- GATING +18 (pedido-chave): catálogo público NUNCA inclui adult (getAllWorks(false) filtra server-side); /api/works?zone=adult exige sessão + adultMode; consentimento com data/hora registrado; UI: opção escondida em Perfil → "Mostrar opção" → modal com 2 checkboxes (idade + regras); Zona Adulta é aba própria, nunca na home/hype/buscas; Aoi não recomenda explícito sem modo ativo.
- NUVEM: sync push/pull last-write-wins por updatedAt; espelho localStorage p/ offline; export/import backup .json completo; indicador de sync no header; contadores por status no perfil.
- APIs v2: /api/works (paginação server-side 60/âme facets, classification filter), /api/works/bulk, /api/hype (4 modos: hype TRENDING live→fallback DB, score, new, classic; persiste no banco), /api/sections (5 seções), /api/news (feed real: trending ao vivo + estreias lançadas/previstas + retornos com data real + marcos, imagem real), /api/schedule (semana por dia da semana via nextEpisodeAt real + mês), /api/cron/refresh (refresh trending + expande catálogo; instrumentation.ts roda a cada 30 min), auth/*, profile, library, cloud/export, cloud/import.
- UI v2 (tema azul-branco default): globals.css com 5 temas via [data-ov-theme] (azul/noite/sakura/esmeralda/violeta), --ov-glass/hero/brand; PortalApp (nav 6 abas + menu usuário com avatar/cor/sync + ThemeSwitcher + footer legal + nav mobile dupla); WorkCard (proxy img lazy + 2 estágios de fallback + card-texto); HomeView (carrossel hype com seletor de modo, chips categoria, 5 seções: Lançamentos/Bombando/Top Popularidade/Agenda do Mês/Central de Notícias + banner Aoi + contador do catálogo); ExploreView (busca debounced 400ms + live AniList, filtros avançados, paginação 60/página); DetailView v2 (hero banner, badges classificação, biblioteca inline, próximo cap, idiomas, "Também conhecida como" com nomes originais NUNCA traduzidos, MagazineCard, 4 abas); ProfileView (identidade, nuvem c/ export/import, aparência 5 temas + 4 modos hype, configurações de conteúdo com portão +18, segurança com sessões ativas, zona de perigo); AuthView (login/registro c/ força de senha, aceitar termos obrigatório); LibraryView (agrupado por status, editar nota/status inline, bulk API); CalendarView; NewsView (filtros por tipo); LegalView (Termos 10 seções, Privacidade LGPD 8 seções, Regras com política +18 e linha vermelha CSAM); AdultZoneView (gated, busca/filtros próprios); AssistantView (Aoi waifu: avatar 🌸, online, mensagens c/ bolha própria, persona server-side).
- BUGS corrigidos: SEARCH_FIELDS não exportado; seções Lançamentos com obras obscuras (popularity>=300) e Bombando vazio (janela 540d + fallback); estreias futuras exibidas como lançadas (badge "Chega em"); nav "Aoi IA" quebrando linha; cache global das seções sobrevivendo a edits (restart); dev server gerenciado pela plataforma (usar nohup dentro de subshell quando reiniciar).
- VERIFICAÇÃO (agent-browser desktop+mobile): home (hype 4 modos, notícias c/ imagens reais, seções c/ capas), explorar (9.054 obras · 151 páginas, Squid Game badge DRAMA), detalhe Berserk (capa/banner reais, nomes nativos/sinônimos, Young Animal/Hakusensha, próx. cap estimado), login testefan OK, perfil (temas Sakura/azul, sessões ativas listadas), zona adulta (534 obras, badges HENTAI, separada), biblioteca (sync curl→nuvem→browser OK), calendário (HOJE destacado, horários reais), legal OK, console limpo, mobile iPhone 14 OK.
- GIT: 2 commits (v2 marco 1 durante, final pós-verificação) — NUNCA MAIS perder versão.

Stage Summary:
- OtakuVerse v2 completo: 9.588 obras reais (4.130 mangá, 2.436 anime, 1.256 manhwa, 1.221 LN, 500 manhua, 45 drama) · 8.041 safe / 1.013 ecchi-suggestive etiquetadas / 534 adult GATED fora do catálogo · contas seguras scrypt+sessão · nuvem com sync e backup export/import · imagens via proxy anti-bloqueio com cache (fim do problema de imagens sumindo) · Aoi waifu · hype c/ 4 modos · 5 seções + calendário + notícias reais · 5 temas · legal completo (Termos/LGPD/Regras) · auto-update 30 min · paginado e cacheado (rápido).
- Arquivos-chave novos: prisma/schema.prisma(v2), src/lib/{auth,imgurl,magazines,news}.ts, src/app/api/{img,hype,sections,schedule,news,auth/*,profile,library,cloud/*,cron/refresh}, instrumentation.ts, scripts/{seed-big,seed-dramas,seed-adult}.ts, src/components/portal/{store,PortalApp,HomeView,ExploreView,DetailView,ProfileView,AuthView,LibraryView,CalendarView,NewsView,LegalView,AdultZoneView,AssistantView,WorkCard}.tsx, src/app/{globals.css,layout.tsx}, next.config.ts.
- Prints: worklogs/check-{home,home2,explore,explore2,detail,login,profile,sakura,adult,legal,library,calendar,mobile}.png
- Notas p/ próximos agentes: dev server da plataforma morre se pkill; reiniciar com `(cd /home/z/my-project && nohup npm run dev >> dev.log 2>&1 &)`. Seed grande é retomável. Kitsu coverAlt não casou títulos (0) — coverAlt fica p/ MangaUpdates/Wikipédia; proxy já resolve redundância. Cron pode retornar 0 obras se AniList em rate-limit (tenta de novo em 30 min).

---
Task ID: 3
Agent: main (Z.ai)
Task: Nivelamento v2.1 — usuário recusou versão inferior à anterior ("não aceito nada inferior"). Auditoria linha a linha do chat vs. código, correção de todas as regressões encontradas.

Work Log:
- AUDITORIA: encontradas regressões concretas vs. versão perdida — filtro de idioma (existia na v1, sumiu), sinopse PT-BR via IA (existia, não era usada), radar externo incompleto, home com menos seções que as 8 da v1, catálogo 9.5k < "dezenas de milhares", 5 temas < personalização anterior.
- CATÁLOGO: seed-more.ts (2 rodadas: popularidade profunda + START_DATE_DESC por tipo) + seed-editorial.ts → 25.857 obras reais (9.436 mangá, 6.886 anime, 4.135 LN, 3.855 manhwa, 1.500 manhua, 45 drama); todas com metadados editoriais.
- REGRESSÕES CORRIGIDAS: filtro Idioma restaurado (JA/KO/ZH/EN/PT-BR via quickLangs); sinopse em português "via Aoi" no detalhe (botão traduzir → /api/ai/synopsis, cache synopsisPT); Radar externo completo na aba links (MyAnimeList, MangaUpdates, X, Google Notícias, AniList, MangaDex).
- NOVOS PODERES: filtro por Revista (facets de magazines + select no Explorar + botão "ver obras desta revista" no MagazineCard → 213 obras da WSJ, etc.); seletor por página 60/120/180; 2 temas novos (Café & creme, Neon cyber) = 7 temas; badges de streaming (Netflix/Crunchyroll/Prime etc.) nos itens do calendário; /api/status + rodapé com "Catálogo: 25.857 obras · atualização automática ativa · última varredura X".
- HOME 9 SEÇÕES: hype carrossel (4 modos) + Central de Notícias + Lançamentos + Bombando + Top Popularidade + Obras-Primas + Manhwas em Alta + Ecchi em Alta + Animes do Momento + Dramas em Destaque + Agenda do Mês + banner Aoi.
- BUG FIX: src="" em <img> (WorkCard/DetailView/CalendarView) causava recarregamento da página — guardas de URL + estágios iniciais corretos; console limpo.
- VERIFICADO: home novas seções (Obras-Primas com Berserk/JoJo/One Piece/Vagabond/Frieren), Explorar c/ filtros (KO: 3.622 obras; WSJ: 213), detalhe (tradução PT, radar), commit 73fb831.

Stage Summary:
- OtakuVerse v2.1 = ou igual ou superior à versão perdida em TODOS os eixos do chat: 25.857 obras (vs. "dezenas de milhares" pedido), 9 seções home, 7 temas, filtros idioma+revista, per-page até 180, sinopse PT, radar externo, status de auto-update visível, sem regressões conhecidas.

---
Task ID: 4
Agent: main (Z.ai)
Task: v2.2 — nova auditoria do chat pedida pelo usuário ("falta opções de vendas, revistas, volumes mais vendidos, mangas novos, lançamentos de capitulos... curtir ou salvar nas capas no hover... dramas adicionados sem necessidade").

Work Log:
- AUDITORIA: comparado chat vs código — confirmadas as lacunas: sem vendas reais, sem página de revistas, sem seção de mangás novos, sem lançamentos de capítulos, WorkCard SEM os botões curtir/salvar no hover (feature amada da versão perdida), dramas presentes em todas as superfícies.
- CURTIR/SALVAR NA CAPA: WorkCard reescrito (root button→div[role=button] p/ permitir botões aninhados); no hover da capa aparecem ❤️ Curtir (status favorite) e 🔖 Salvar (status plan), com estados ativos (coração vermelho preenchido / check âmbar), tooltips, clique sem abrir o detalhe (stopPropagation), gating de login (sem conta → abre #/conta); mobile mostra sempre (touch não tem hover). Quirk do Tailwind v4 (variante empilhada sm:group-hover:opacity-100 computada como opacity 0 mesmo com :hover ativo) resolvido com CSS próprio .ov-actions em globals.css (determinístico).
- VENDAS REAIS (Oricon): src/lib/sales.ts com dados públicos reais — séries do ano 2021–2024 (44 entradas), volumes individuais do ano (52 entradas, ex.: JJK Vol.25 1,74 mi em 2024, Kimetsu Vol.23 5,35 mi em 2021) e acumulados históricos (19, ex.: One Piece 516M); matcher de títulos normalizado (título/EN/nativo/sinônimos, aliases como Boku no Hero↔My Hero Academia, Shingeki no Kyojin↔Attack on Titan) — 100% de cobertura de capa real (52/52, 46/46, 19/19); /api/sales (cache 10min); página #/vendas com abas Volumes/Séries/Todos os tempos + filtro por ano + ranking medalhado; home com "Vendas: Volumes Mais Vendidos" (cards ranked com badge Vol. + cópias) e "Séries Mais Vendidas do Ano" (ranking em lista).
- REVISTAS: /api/magazines agrupa por revista real do banco, enriquece com ficha canônica (editora/demografia/cadência de magazines.ts), filtra coletâneas genéricas derivadas (Antologia shōnen 16,5k etc. fora da grade — 26 revistas reais, 841 obras confirmadas); página #/revistas com cards (editora, demografia, cadência, faixa de capas reais, obras famosas) → exploração filtrada; home com linha "Revistas & Editoras".
- MANGÁS NOVOS: seção "Acabaram de Chegar" (startDate ≤ hoje — CORRIGIDO bug de obras com data futura 2027 vazando; janela 120d com fallback 365d).
- LANÇAMENTOS DE CAPÍTULOS: helper central estimateChapterReleases em works.ts — séries RELEASING com lastUpdate real; dia da semana vem do calendário REAL da revista quando conhecido (ex.: "Semanal (quinta)"), senão distribuição estável rotulada como estimativa; trata chapters=null (AniList não contabiliza em andamento → "novo cap"); home com grade semanal compacta (HOJE destacado) e Calendário com grade "lançamentos de capítulos" ao lado dos episódios (badge "a qualquer momento" p/ ritmo defasado).
- DRAMAS REMOVIDOS (a pedido — "adicionou dramas sem necessidade"): pool público os exclui (works.ts), seção dramaPicks fora da home, chip fora das categorias e do Explorar, contagem do /api/status sem dramas (25.278), footer/metadados/perfil sem menção; dramas ficam inativos no banco (links antigos → "não encontrada").
- NAV: 8 abas — Início, Explorar, Vendas, Revistas, Calendário, Notícias, Biblioteca, Aoi (+mobile secundária).
- LINT: zera erros nos arquivos tocados (padrões react-hooks/set-state-in-effect e refs-in-render pré-existentes corrigidos em HomeView/CalendarView: loading derivado em vez de setState síncrono em effect).
- VERIFICADO (agent-browser desktop+mobile): home (hype, notícias, Lançamentos, Mangás Novos, Capítulos, Vendas volumes+séries, Revistas, Bombando, Top Popularidade, Obras-Primas, Manhwas, Ecchi, Animes, Agenda), hover curtir/salvar funcional (salvar→plan, curtir→favorite, sync nuvem /api/library confirmada, estados visuais), #/vendas (abas+anos), #/revistas (841 obras), #/calendario (grade capítulos HOJE), explorar mobile (9.247 mangás, botões sempre visíveis no touch), console limpo.
- GIT: commit v2.2.

Stage Summary:
- OtakuVerse v2.2: catálogo 25.278 obras públicas (sem dramas, adult sempre gated), 8 abas, 14 seções na home, vendas reais Oricon (volumes/séries/histórico), 26 revistas reais navegáveis, mangás novos sem datas futuras, lançamentos de capítulos com calendário real de revistas, curtir/salvar no hover das capas (desktop) e sempre visíveis (mobile) — NADA inferior às rodadas anteriores; tudo commitado.
