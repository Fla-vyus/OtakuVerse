#!/bin/bash
# Poda do standalone v3.9 — remove do .next/standalone o que o modo TURSO não usa.
# (o script build já remove db/skills/src/scripts; este trata o node_modules)
#
# Economia medida: ~68MB (standalone 200MB → ~132MB).
#   1. engines WASM de postgres/mysql/cockroachdb/sqlserver (24MB) — o provider
#      do schema é sqlite; só os pares *.sqlite.* são usados pelo query compiler
#   2. libquery_engine-*.so.node (17MB) — engine Rust de ARQUIVO; no modo adapter
#      (libsql/Turso) as queries são compiladas pelo WASM, nunca pelo Rust engine
#   3. @libsql/linux-x64-musl (9.5MB) — binding para Alpine; containers Debian usam gnu
#   4. node_modules aninhado do adapter-libsql (17MB) — duplicata do @libsql 0.8.1;
#      a resolução sobe para o @libsql/client 0.18 do topo (API compatível, testado)
#
# ⚠️ Este script PRESSUPÕE o modo Turso em runtime (otakuverse.runtime.json).
#    Se um dia voltar a rodar SQLite de arquivo a partir do standalone, remova
#    o item 2 (o engine Rust é exigido pelo Prisma sem adapter).
set -e
cd "$(dirname "$0")/.."
S=.next/standalone
[ -d "$S" ] || { echo "[slim] .next/standalone não existe — rode npm run build antes"; exit 1; }

ANTES=$(du -sm "$S" | cut -f1)

# 1) WASM de outros bancos
for db in postgresql mysql cockroachdb sqlserver; do
  rm -f "$S"/node_modules/@prisma/client/runtime/query_engine_bg."$db".wasm-base64.* \
        "$S"/node_modules/@prisma/client/runtime/query_compiler_bg."$db".wasm-base64.*
done

# 2) engine Rust de arquivo — ⚠️ MANTER! Testado em v3.9: o Prisma 6.19 EXIGE o
#    binário presente mesmo em modo adapter (validação na inicialização do client;
#    sem ele: "could not locate the Query Engine" em TODA query).

# 3) binding musl
rm -rf "$S"/node_modules/@libsql/linux-x64-musl

# 4) duplicata do adapter (17MB) — ⚠️ MAS o tracing do turbopack cria stubs em
#    .next/node_modules/ como SYMLINKS apontando para ela. Bun (runtime da
#    plataforma) segue o symlink à risca: ENOENT → crash no carregamento do chunk
#    do banco → HTTP 500 vazio em TODA API (node perdoa resolvendo pelo topo).
#    Causa real do deploy v3.9 sem dados (diagnosticado 30/10 com bun repro local).
rm -rf "$S"/node_modules/@prisma/adapter-libsql/node_modules

# 4.5) conserta stubs órfãos: troca o symlink quebrado por uma CÓPIA REAL do pacote
#      equivalente do topo (mesma API — @libsql/client 0.18 no lugar do 0.8.1).
find "$S/.next/node_modules" -xtype l 2>/dev/null | while read -r link; do
  tgt="$(readlink "$link")"
  pkg="${tgt##*node_modules/}"
  if [ -d "$S/node_modules/$pkg" ]; then
    rm -rf "$link"
    cp -r "$S/node_modules/$pkg" "$link"
    echo "[slim] stub órfão $(basename "$link") → cópia real de $pkg (fix bun)"
  else
    echo "[slim] AVISO: stub quebrado SEM equivalente no topo: $link → $tgt"
  fi
done
ORFAOS=$(find "$S/.next/node_modules" -xtype l 2>/dev/null | wc -l)
if [ "$ORFAOS" -gt 0 ]; then
  echo "[slim] ERRO: $ORFAOS stub(s) quebrado(s) restante(s) — abortando (bun morreria em produção)"
  exit 1
fi

# 5) .env tracado — o Next standalone carrega .env do próprio diretório ANTES do
#    runtime-env.ts, e um .env com DATABASE_URL=file: forçaria modo arquivo num
#    container sem banco (descoberto no teste de contrato da plataforma v3.9)
rm -f "$S"/.env "$S"/.env.production "$S"/.env.local

# 6) v3.9.5 — GARANTIA do otakuverse.runtime.json dentro do standalone.
#    O outputFileTracingIncludes do next.config NÃO é honrado de forma estável
#    pelo Turbopack (standalone de 30/10 saiu SEM o json). Local isso passa
#    despercebido porque o runtime-env acha o json no PAI do standalone; na
#    plataforma o standalone é órfão → sem json = modo FILE silencioso (sem
#    Turso, sem Aoi, catálogo importado gota-a-gota — incidente "site limitado").
#    Cópia explícita a partir da raiz + verificação dura (fonte da verdade = raiz).
#    v3.9.5b: fallback para o cofre externo — o sandbox da plataforma apaga arquivos
#    não-rastreados a cada hibernação/restauração do workspace; o json vive também
#    em /home/z/.otakuverse-credentials.json e se auto-restaura para a raiz.
if [ ! -f otakuverse.runtime.json ] && [ -f /home/z/.otakuverse-credentials.json ]; then
  cp -f /home/z/.otakuverse-credentials.json otakuverse.runtime.json
  echo "[slim] runtime json restaurado do cofre externo"
fi
if [ -f otakuverse.runtime.json ]; then
  cp -f otakuverse.runtime.json "$S/otakuverse.runtime.json"
  echo "[slim] runtime json copiado para o standalone ($(wc -c < "$S/otakuverse.runtime.json") bytes)"
else
  echo "[slim] ERRO: otakuverse.runtime.json ausente na raiz — payload subiria sem Turso/Aoi. Abortando."
  exit 1
fi
if [ ! -s "$S/otakuverse.runtime.json" ]; then
  echo "[slim] ERRO: cópia do runtime json falhou/vazia — abortando."
  exit 1
fi

DEPOIS=$(du -sm "$S" | cut -f1)
echo "[slim] standalone: ${ANTES}MB → ${DEPOIS}MB (poda v3.9)"
