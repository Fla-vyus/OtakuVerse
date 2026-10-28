#!/bin/bash
# Deploy canônico do OtakuVerse — v3.4 (à prova de esquecimento).
#
# Usage: bash /home/z/my-project/scripts/deploy.sh
#
# Codifica as 3 lições duras dos deploys anteriores:
#   1. Processos com &/setsid morrem no fim da sessão bash → servidor é iniciado
#      com double-fork via node (detached + unref).
#   2. Next renomeia o processo para "next-server (vX.Y.Z)" → pkill -f "standalone/server.js"
#      NÃO pega nada; é obrigatório pkill -f "next-server".
#   3. Turbopack pode emitir .next/standalone STALE → SEMPRE clean build (rm -rf .next)
#      e verificação de marcador pós-build.
#
# TRAP de segurança: em SUCESSO ou FALHA, a pausa do keepalive é SEMPRE removida
# (jamais um deploy deixa o daemon pausado de novo — foi a causa da home morta).

set -u
cd /home/z/my-project || exit 1
PAUSE=/home/z/my-project/.keepalive-pause
LOG=/home/z/my-project/deploy.log
log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
cleanup() {
  rm -f "$PAUSE"
  log "pausa do keepalive removida (trap) — daemon sempre reativado"
}
trap cleanup EXIT

log "=== deploy iniciado (pid $$) ==="
touch "$PAUSE"
log "keepalive pausado"

# 1) Clean build (turbopack stale nunca mais)
log "limpando .next e compilando…"
rm -rf .next
if ! npm run build >> "$LOG" 2>&1; then
  log "ERRO: build falhou — mantendo servidor atual (se vivo) e abortando"
  exit 1
fi

# 2) Marcador de código novo (dedupe de franquia usa "temporada" no chunk de seções)
if rg -l "temporada" .next/standalone/.next/server/chunks/ >/dev/null 2>&1; then
  log "marcador OK: código novo presente no standalone"
else
  log "AVISO: marcador 'temporada' ausente no standalone — build possivelmente stale"
fi

# 3) Mata TUDO que possa servir na 3000 (next-server é o nome real do processo)
log "parando servidor antigo…"
pkill -f "next-server" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
sleep 3

# 4) Inicia com double-fork (sobrevive ao fim desta sessão bash)
log "iniciando produção…"
node -e "require('child_process').spawn('bash',['-c','DATABASE_URL=file:/home/z/my-project/db/custom.db PORT=3000 NODE_ENV=production node /home/z/my-project/.next/standalone/server.js >> /home/z/my-project/server.log 2>&1'],{detached:true,stdio:'ignore'}).unref()"

# 5) Health check (até 60s)
OK=0
for i in $(seq 1 20); do
  sleep 3
  H=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000/api/health)
  if [ "$H" = "200" ]; then OK=1; break; fi
done
if [ "$OK" = "1" ]; then
  log "DEPLOY OK — /api/health 200 (após $((i*3))s)"
else
  log "ERRO: health check falhou após 60s — keepalive vai assumir a recuperação"
fi
log "=== deploy finalizado ==="
