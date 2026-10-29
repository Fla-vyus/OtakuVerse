# 🚀 Deploy do OtakuVerse na PLATAFORMA (v3.9) — publicação em etapas

> Substitui o fluxo Vercel (v3.8) como caminho principal. O banco agora vive no
> **Turso** (`libsql://otakuverse-fla-vyus.turso.io`) — o deploy NÃO carrega mais
> o SQLite de 85MB, e cadastros de usuários ficam persistentes na nuvem.

## Por que os deploys anteriores falharam (análise v3.9)

| Causa | Evidência | Correção v3.9 |
|---|---|---|
| Payload inflado | standalone 350MB (skills/ 61MB + db/ 85MB + src/ tracados; engines WASM de 5 SGBDs; duplicatas do @libsql) | tracing excludes + poda pós-build → **131MB** |
| Env de runtime inexistente | plataforma roda `bun server.js` sem injetar variáveis; Next standalone não carrega .env do cwd esperado | `otakuverse.runtime.json` viaja no payload e é lido no boot (`src/lib/runtime-env.ts`) |
| `.env` tracado forçava modo arquivo | teste de contrato detectou `.env` dentro do standalone (Next carrega antes do app) | `.env` raiz esvaziado + poda remove `.env` do standalone |
| Jobs de disco em container sem disco | restore/backup/snapshot presumem `db/`, `scripts/`, `.git` | modo libsql desliga jobs de disco (Turso Cloud + cron assumem) |
| Datas epoch-ms no Turso | adapter Prisma rejeita int em DateTime ("Inconsistent column data") | `scripts/turso-fix-dates.mjs --fix` — 40.456 linhas normalizadas |
| Pico de memória no boot | warmup auto-HTTP (~1.1GB em Bun) | (v3.7.6) warmup só em dev; hidratação do pool pico ~1GB por ~30s, assenta em ~550MB |
| **Runtime é BUN, não node** | deploys v3.9 subiam com APIs 500 vazias: o Turbopack externaliza `@libsql/client` como symlink em `.next/node_modules/` apontando para a duplicata podada; bun segue o symlink à risca (ENOENT → crash do chunk do banco); node perdoa — por isso o teste local com node passava | (v3.9.2) slim troca stub órfão por cópia real do pacote do topo + porta de segurança que ABORTA o build se sobrar symlink quebrado. **Contrato de teste canônico agora é bun + `env -i` + cwd=standalone** |

## Estado validado (local, contrato idêntico ao da plataforma)

- `env -i` + cwd = standalone + nenhuma env injetada → boot ✓
- `[runtime-env] banco: libsql (Turso)` + jobs de disco desligados ✓
- health `healthy` · pool 40.456 · busca/obra/home HTTP 200 ✓
- Playwright: 81 imgs, 79 cards, 0 erros de hidratação ✓
- Aoi responde (fallback sandbox; em produção usará `AI_API_KEY` do runtime json) ✓

## O arquivo `otakuverse.runtime.json`

Vive na raiz, **não vai ao GitHub** (gitignore), **viaja no payload** (tracing include):

```json
{
  "DATABASE_URL": "libsql://otakuverse-fla-vyus.turso.io",
  "TURSO_AUTH_TOKEN": "eyJ…",          // ⚠️ SEM EXPIRAÇÃO (o atual expira!)
  "AI_BASE_URL": "https://api.z.ai/api/paas/v4",
  "AI_API_KEY": "",                     // opcional — Aoi fica limitada sem ela
  "AI_MODEL": "glm-4.5-flash"
}
```

Prioridade: env do processo **>** runtime json. `env -u DATABASE_URL` nos
launchers impede herança suja da sessão.

## Etapas de publicação (uma por vez, validando cada checkpoint)

**Etapa 0 — pré-requisitos (antes de qualquer Publicar):**
1. Token Turso **sem expiração** → app.turso.tech → database → Tokens → expiração
   "None" → colar no chat (eu troco no runtime json e revalido).
2. (Opcional, recomendado) `AI_API_KEY` da Z.ai → z.ai/manage-apikey.
3. Build fresco: `bash scripts/deploy.sh` (clean build + slim + health).

**Etapa 1 — Publicar (payload ~150MB, sem db):** valida se o fluxo de publish
aceita o peso reduzido. Checkpoint: abrir a URL pública → home com capas.
- Se falhar: anotar o erro exato na plataforma → nos dá a causa real (peso vs
  tempo de health check vs memória).

**Etapa 2 — se falhar por memória:** contingers preparados:
- `OTAKUVERSE_POOL_MAX` (cap do pool em memória — requer pequeno patch em works.ts)
- Remover `data/catalog-snapshot.jsonl.gz` do payload (-21MB; cold start passa a
  hidratar do Turso em ~20-60s)

**Etapa 3 — se falhar por timeout de health:** o boot precisa responder em
janela curta; a hidratação do snapshot já é pós-health (não bloqueia). Investigar
o que o health check da plataforma exige (rota? porta? tempo?).

## Manutenção

- Reimport do catálogo: `npm run turso:import -- --fresh` + `node scripts/turso-fix-dates.mjs --fix`
- Token do Turso: trocar no runtime json + restart
- O `db/custom.db` local continua para dev offline (scripts dev/start agora
  priorizam o runtime json; `DATABASE_URL` externo sempre vence)
