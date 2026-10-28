#!/bin/bash
# Keepalive do OtakuVerse — DAEMON v2 (blindado).
# Loop a cada 30s: 2 checagens de /api/health falhando seguidas → reinicia o servidor.
# Prefere o servidor de PRODUÇÃO (standalone); se o build não existe, cai para o dev.
#
# v2 — lições do incidente de 28/10 (home morta):
#   1. PAUSA COM VALIDADE: se .keepalive-pause ficar > 30 min (deploy quebrou no meio
#      e esqueceu de remover), o daemon Remove o arquivo e retoma a vigilância sozinho.
#      Pausa órfã = servidor morto para sempre = "o início está morto outra vez".
#   2. Nunca reinicia o servidor na 1ª falha (evita derrubar restarts normais).
#
# Como rodar (método double-fork — sobrevive ao fim da chamada do shell, diferente de nohup):
#   node -e "require('child_process').spawn('bash',['/home/z/my-project/scripts/keepalive.sh'],{detached:true,stdio:'ignore'}).unref()"
#
# Pausa temporária (durante rebuild/deploy): toque em .keepalive-pause e o daemon só observa.
#   touch /home/z/my-project/.keepalive-pause   # pausa
#   rm /home/z/my-project/.keepalive-pause      # retoma
#   (se esquecer de remover, expira sozinha em 30 min)

cd /home/z/my-project || exit 1
LOG=/home/z/my-project/keepalive.log
PAUSE=/home/z/my-project/.keepalive-pause
PAUSE_MAX_AGE_SEC=1800   # pausa órfã expira em 30 minutos
log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
rotate() { # mantém o log enxuto (últimas 2000 linhas)
  if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 4000 ]; then
    tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
}

log "daemon v2 iniciado (pid $$)"
consec=0
while true; do
  sleep 30
  rotate

  # pausa manual (deploy/rebuild) — mas com validade: órfã expira em 30 min
  if [ -f "$PAUSE" ]; then
    AGE=$(( $(date +%s) - $(stat -c %Y "$PAUSE" 2>/dev/null || echo 0) ))
    if [ "$AGE" -gt "$PAUSE_MAX_AGE_SEC" ]; then
      rm -f "$PAUSE"
      log "pausa órfã (${AGE}s) EXPIRADA — removida automaticamente, vigilância retomada"
    else
      consec=0
      continue
    fi
  fi

  H=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000/api/health)
  if [ "$H" = "200" ]; then
    consec=0
    continue
  fi
  consec=$((consec+1))
  log "health=$H ($consec/2)"
  [ "$consec" -lt 2 ] && continue
  consec=0

  log "reiniciando servidor…"
  pkill -f "next-server" 2>/dev/null
  pkill -f "standalone/server.js" 2>/dev/null
  pkill -f "next dev" 2>/dev/null
  sleep 3
  if [ -f /home/z/my-project/.next/standalone/server.js ]; then
    DATABASE_URL="file:/home/z/my-project/db/custom.db" PORT=3000 NODE_ENV=production \
      setsid node /home/z/my-project/.next/standalone/server.js >> /home/z/my-project/server.log 2>&1 &
    log "servidor de PRODUÇÃO reiniciado"
  else
    setsid npm run dev >> /home/z/my-project/dev.log 2>&1 &
    log "servidor DEV reiniciado (build de produção inexistente)"
  fi
done
