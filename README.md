# OtakuVerse

Portal de descoberta de cultura pop asiática em português: **mangás, manhwas, manhuas, light novels, webnovels e animes** — catálogo real de dezenas de milhares de obras, hype ao vivo, calendário de capítulos, notícias editoriais, vendas (Oricon), revistas, streaming e a curadora de IA Aoi. PWA instalável, com zona +18 totalmente isolada e monetização por país.

> 40.000+ obras · custo de infraestrutura R$ 0 · dados reais de fontes públicas (AniList, MangaUpdates, Kitsu, TVMaze, Oricon editorial)

## Stack

- **Next.js 16** (App Router, standalone) + **TypeScript** + **Tailwind** + shadcn/ui
- **Prisma + SQLite** (WAL) — `db/custom.db`, com pool em memória (single-flight + stale-while-revalidate)
- **PWA**: manifest + service worker + ícones locais
- Deploy próprio: `scripts/deploy.sh` (build limpo, marcador de versão, double-fork, health check) + `scripts/keepalive.sh` (daemon v3) + `scripts/scheduler-daemon.sh` (sync 30 min)

## Rodando localmente

```bash
npm install
npx prisma generate
npm run build
DATABASE_URL=file:/abs/path/db/custom.db PORT=3000 node .next/standalone/server.js
```

Variáveis de ambiente — veja `.env.example`. Nenhuma é obrigatória para o site funcionar; as de monetização/métrica são opcionais e ativam recursos ao serem preenchidas.

## Arquitetura de durabilidade (nada se perde)

1. **Backup SQLite diário** — `VACUUM INTO` + `integrity_check`, rotação de 10 em `db/backups/`
2. **Snapshot git-safe a cada 6h** — catálogo + contas em `data/` com manifest sha256, auto-commit
3. **Cofre externo 6h** — mesmo banco em `.db/.sql/.jsonl/.csv` fora do diretório do projeto
4. **Auto-restore no boot** — se a contagem cair ≥10% contra o snapshot bom, restaura aditivamente
5. **Watchdog com cura ativa** — pool vazio com banco saudável é reconstruído na hora; keepalive detecta health `200-degradado`, reaquece e reinicia se persistir

## Segurança e conteúdo

- Sessões por cookie httpOnly + scrypt (senha), rate limit no login, `CRON_KEY` nos gatilhos de manutenção
- CSP fechada (self + allowlist explícita para analytics/ads), HSTS, nosniff, anti-clickjacking
- **Zona +18 isolada**: conteúdo adulto fora do pool público, só entra com modo adulto ativo no perfil (sessão + confirmação), nunca aparece em home/rankings/recomendações
- **Anúncios somente em páginas classificadas `safe`** — o `AdSlot` bloqueia suggestive/adult/zona adulta automaticamente
- Nomes originais nunca traduzidos; sem imagens geradas por IA

## Monetização (por país)

- `src/lib/affiliates.ts` — lojas reais por região (BR/PT/US/CA/UK/ES/MX/AR/CL/CO/FR/DE/IT/JP/Global): Amazon Associates por país (tags via `NEXT_PUBLIC_AMAZON_TAG_*`), Mercado Livre, Estante Virtual, Casa del Libro, Gandhi, Wook, Barnes & Noble, Waterstones, Rakuten, BOOK☆WALKER, CDJapan, Kobo, Google Play Livros…
- `BuyPanel` — painel "Onde comprar" na página da obra, com seletor de país (detecção automática pelo navegador + override salvo), `rel="sponsored"` e disclosure de comissão
- `AdSlot` — Google AdSense sob 5 portões de segurança; sem `NEXT_PUBLIC_ADSENSE_CLIENT` renderiza nada
- `src/app/ads.txt` — servido automaticamente quando o client AdSense é configurado
- `Analytics` — GA4 (`NEXT_PUBLIC_GA_ID`) e/ou Cloudflare Web Analytics (`NEXT_PUBLIC_CF_BEACON`), ambos com camada gratuita; nada carrega sem env

## Fontes de dados (gratuitas)

AniList (catálogo/tendências) · MangaUpdates (webnovels) · Kitsu (redundância) · TVMaze (streaming) · feeds editoriais próprios. Todas com circuit breaker por fonte (`src/lib/broker.ts`) — uma fonte fora do ar não derruba o portal.

## Scripts úteis

```bash
scripts/deploy.sh            # deploy completo (build limpo + marcador + double-fork + health)
scripts/keepalive.sh         # daemon de vigilância (v3: detecta 200-degradado e cura)
scripts/scheduler-daemon.sh  # tick de 30 min para o sync do catálogo
scripts/db-backup.ts         # backup VACUUM INTO + integrity_check
scripts/catalog-snapshot.ts  # snapshot git-safe (data/)
scripts/vault-sync.ts        # cofre externo multi-formato
```
