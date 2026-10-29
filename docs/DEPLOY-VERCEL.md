# 🚀 Deploy do OtakuVerse na Vercel + Turso (v3.8)

O site agora roda **de graça** fora da plataforma Z.ai, com deploy automático:
cada `git push` na `main` publica produção sozinho. Este guia é o passo-a-passo
completo — leva ~15 minutos na primeira vez.

## O que mudou na v3.8 (migração serverless)

| Componente | Antes (sandbox) | Agora (Vercel + Turso) |
|---|---|---|
| Banco | SQLite em arquivo (84MB) | **Turso** (libSQL na nuvem) — mesmo schema Prisma |
| Aoi | SDK interno da sandbox (`.z-ai-config`) | Endpoint **OpenAI-compatible por env** (default: API pública da Z.ai, GLM-4.5-Flash grátis) |
| Sitemap | 1 arquivo de 6.3MB | **Índice + 4 chunks** (~1.7MB cada — limpa o limite de 4.5MB da Vercel) |
| Cache de 40k obras | Construído do SQLite no boot | **Hidratado do snapshot em ~0.7s** no cold start; revalida do Turso a cada 15min |
| Backup/snapshot/vault | Jobs locais no servidor | **Turso Cloud** (backups gerenciados + point-in-time restore) |
| Refresh do catálogo | setInterval 30min | **Vercel Cron** diário → `/api/cron/tick` |
| Cache de imagens | `db/imgcache` (4GB) | `/tmp` na Vercel (512MB, efêmero por instância) |

Localmente NADA muda: `npm run dev` continua servindo produção standalone com o
SQLite de arquivo, como sempre. O mesmo código decide o modo pelo prefixo da
`DATABASE_URL` (`file:` = local, `libsql://` = Turso).

---

## Passo 1 — Criar o banco no Turso (~5 min)

1. Acesse **https://app.turso.tech** e entre com **Sign in with GitHub** (plano Free: 5GB, 500M leituras/mês).
2. Botão **Create Database**:
   - Nome: `otakuverse`
   - Location/Region: **São Paulo (gru1)** — mesma região do deploy na Vercel.
3. Na tela do database, aba **Connect**:
   - Copie a **URL** → algo como `libsql://otakuverse-<sua-org>.turso.io`
   - Clique em **Create Token** (ou "Generate Token") e copie o **token** (começa com `eyJ...`).

## Passo 2 — Preencher o banco com o catálogo (1 comando)

Com `TURSO_URL` e `TURSO_AUTH_TOKEN` em mãos (pode ser colado aqui no chat —
o assistente executa), rode:

```bash
TURSO_URL=libsql://otakuverse-<org>.turso.io \
TURSO_AUTH_TOKEN=eyJ... \
npm run turso:import
```

O script copia DDL + as ~40 mil obras (+ todas as tabelas) em lotes e verifica
as contagens no final. Dura ~2-5 minutos. Para reimportar do zero: `--fresh`.

## Passo 3 — Chave da Aoi na API pública da Z.ai (~3 min)

1. Acesse **https://z.ai/manage-apikey/apikey-list** (ou z.ai → API Platform) e crie uma API key.
2. O modelo **GLM-4.5-Flash** (`glm-4.5-flash`) é **gratuito** — é o default da Aoi.
3. Guarde a chave (formato `xxxxxxxx.xxxxxxxx`).

## Passo 4 — Deploy na Vercel (~5 min)

1. Acesse **https://vercel.com** → **Sign in with GitHub** (plano Hobby, grátis).
2. **Add New… → Project** → selecione o repositório **Fla-vyus/OtakuVerse** → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e cadastre:

| Nome | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | `libsql://otakuverse-<org>.turso.io` | ✅ |
| `TURSO_AUTH_TOKEN` | `eyJ...` (token do Passo 1) | ✅ |
| `NEXT_PUBLIC_SITE_URL` | `https://otakuverse.vercel.app` | ✅ |
| `CRON_SECRET` | qualquer segredo forte (`openssl rand -hex 24`) | ✅ |
| `AI_BASE_URL` | `https://api.z.ai/api/paas/v4` | ✅ |
| `AI_API_KEY` | chave do Passo 3 | ✅ |
| `AI_MODEL` | `glm-4.5-flash` | ⬜ (default já é esse) |

4. **Deploy**. O build roda `prisma generate` + `next build` (45min de teto, o nosso leva ~3min).
5. Pronto: `https://otakuverse.vercel.app` no ar.

O `vercel.json` já configura região **gru1 (São Paulo)**, memória das funções
(1792MB — o pool de 40k obras pica ~757MB) e o cron diário do refresh.

> **Dica:** futuros `git push` na `main` = deploy automático. Nada de botão Publicar.

## Passo 5 — Checklist de validação (2 min)

| Teste | URL esperada | Resultado esperado |
|---|---|---|
| Home | `https://…vercel.app/` | cards + capas carregando, 5 seções |
| Detalhe | `https://…vercel.app/obra/16498` | h1, sinopse, related |
| Health | `/api/health` | `{"ok":true,…}` |
| Sitemap índice | `/sitemap.xml` | `sitemapindex` com 4 chunks |
| Sitemap chunk | `/sitemap/0.xml` | XML ~1.7MB, status 200 |
| Aoi | abrir o chat da Aoi e perguntar | resposta em PT-BR (modelo GLM) |
| Busca | buscar "chainsaw" | resultados do catálogo |

## Perguntas frequentes

**O cache de imagens sumiu?** Na Vercel o disco é efêmero — o cache em `/tmp`
continua valendo dentro de cada instância (protege contra rate limit dos CDNs
naquele período). O comportamento local (4GB persistentes) não muda.

**E os backups?** Turso Cloud faz backup automático com point-in-time restore
no plano free (1 dia de retenção). O snapshot git continua sendo gerado na
sandbox e commitado como cofre extra.

**Quanto custa se estourar?** Plano Hobby não cobra: quando os limites do mês
acabam (4h de CPU ativa, 360 GB-horas de memória provisionada, 1M requests),
as funções passam a ser bloqueadas até o ciclo seguinte. Para o tráfego de
lançamento, os limites dão folga; monitore em vercel.com → Usage.

**Domínio próprio?** Depois, em Settings → Domains: aponte o DNS e pronto
(continua a única exceção paga combinada).

**Rollback?** Cada deploy fica no histórico da Vercel — um clique volta
qualquer versão anterior.
