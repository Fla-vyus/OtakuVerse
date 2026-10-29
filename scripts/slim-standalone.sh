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

# 4) duplicata do adapter
rm -rf "$S"/node_modules/@prisma/adapter-libsql/node_modules

# 5) .env tracado — o Next standalone carrega .env do próprio diretório ANTES do
#    runtime-env.ts, e um .env com DATABASE_URL=file: forçaria modo arquivo num
#    container sem banco (descoberto no teste de contrato da plataforma v3.9)
rm -f "$S"/.env "$S"/.env.production "$S"/.env.local

DEPOIS=$(du -sm "$S" | cut -f1)
echo "[slim] standalone: ${ANTES}MB → ${DEPOIS}MB (poda v3.9)"
