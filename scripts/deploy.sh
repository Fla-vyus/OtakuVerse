#!/bin/bash
# Deploy canônico do OtakuVerse — v3.5 (à prova de esquecimento).
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

# 2) Marcadores de código novo (chunk de seções v3.5: partes core/more + webnovels)
if rg -l "webnovelPicks" .next/standalone/.next/server/chunks/ >/dev/null 2>&1; then
  log "marcador OK: código novo (v3.5) presente no standalone"
else
  log "AVISO: marcador 'webnovelPicks' ausente no standalone — build possivelmente stale"
fi
if rg -l "sectionsCoreCache" .next/standalone/.next/server/chunks/ >/dev/null 2>&1; then
  log "marcador OK: /api/sections com fases (core/more)"
else
  log "AVISO: marcador 'sectionsCoreCache' ausente — build possivelmente stale"
fi

# 2.5) v3.7.1: o file tracing do turbopack copia scripts referenciados por string
#      (ex.: scripts/db-backup.ts) para .next/standalone — isso ENGANA a detecção
#      de raiz do projeto nos jobs (src/lib/jobs.ts projectRoot usa prisma/ como
#      marcador agora, mas remover o diretório intruso evita qualquer ambiguidade).
rm -rf .next/standalone/scripts 2>/dev/null || true

# 2.7) v3.9.5 — PORTÃO DE CREDENCIAIS: sem o runtime json dentro do standalone a
#      plataforma sobe em modo FILE silencioso (catálogo mínimo importado de
#      fontes externas — incidente "funciona, está limitado" de 30/10).
if [ ! -s .next/standalone/otakuverse.runtime.json ]; then
  log "ERRO: otakuverse.runtime.json ausente/vazio no standalone — payload subiria sem Turso/Aoi. Abortando."
  exit 1
fi
log "portão de credenciais OK: runtime json presente no standalone"

# 3) Mata TUDO que possa servir na 3000 (next-server é o nome real do processo)
log "parando servidor antigo…"
pkill -f "next-server" 2>/dev/null
pkill -f "standalone/server.js" 2>/dev/null
sleep 3

# 4) Inicia com double-fork (sobrevive ao fim desta sessão bash).
#    .env exportado (DATABASE_URL + CRON_KEY) — a rota /api/cron/tick depende da chave.
#    v3.7.2: OTAKUVERSE_ROOT — raiz REAL do projeto para os jobs de fundo (src/lib/jobs.ts
#    resolve scripts/backups/git a partir dela; o cwd do standalone engana a detecção).
log "iniciando produção…"
node -e "require('child_process').spawn('bash',['-c','set -a; source /home/z/my-project/.env; set +a; export OTAKUVERSE_ROOT=/home/z/my-project; unset DATABASE_URL; PORT=3000 NODE_ENV=production node /home/z/my-project/.next/standalone/server.js >> /home/z/my-project/server.log 2>&1'],{detached:true,stdio:'ignore'}).unref()"

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

# 6) Agendador PERMANENTE (tick de 30min via HTTP) — relança se não estiver vivo.
#    O servidor também tem seu próprio setInterval de 30min; as camadas se cobrem.
if pgrep -f "scheduler-daemon.sh" >/dev/null 2>&1; then
  log "scheduler-daemon já vivo — nada a fazer"
else
  node -e "require('child_process').spawn('bash',['/home/z/my-project/scripts/scheduler-daemon.sh'],{detached:true,stdio:'ignore'}).unref()"
  log "scheduler-daemon iniciado (tick 30min permanente)"
fi

log "=== deploy finalizado ==="
