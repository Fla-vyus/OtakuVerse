#!/bin/bash
# Keepalive do OtakuVerse — DAEMON v3 (blindado).
# Loop a cada 30s:
#   · HTTP falho 2× seguidas  → reinicia o servidor (v2).
#   · HTTP 200 porém "degradado" (pool de obras vazio) → reaquece o catálogo na hora;
#     se continuar degradado por 4 checagens (~2 min), reinicia (v3 — incidente de 28/10:
#     health respondia 200 com pool vazio e o site ficava "sem conexão com o catálogo"
#     por horas porque o daemon achava que estava tudo bem).
# Prefere o servidor de PRODUÇÃO (standalone); se o build não existe, cai para o dev.
#
# v2 — lições do incidente de 28/10 (home morta):
#   1. PAUSA COM VALIDADE: se .keepalive-pause ficar > 30 min (deploy quebrou no meio
#      e esqueceu de remover), o daemon Remove o arquivo e retoma a vigilância sozinho.
#   2. Nunca reinicia o servidor na 1ª falha (evita derrubar restarts normais).
# v3 — health "200 mas degradado" passa a ter dono.
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

log "daemon v3 iniciado (pid $$)"
consec=0
degr=0
HFILE=/tmp/ov-health.json
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
      degr=0
      continue
    fi
  fi

  H=$(curl -s -o "$HFILE" -w "%{http_code}" --max-time 20 http://localhost:3000/api/health)
  if [ "$H" = "200" ]; then
    if grep -q '"ok":false' "$HFILE" 2>/dev/null; then
      # v3: 200 porém degradado (ex.: worksCache vazio) — primeiro REAQUECE,
      # depois reinicia se persistir (o rebuild do pool leva segundos, não precisa de tiro de canhão)
      degr=$((degr+1))
      log "health 200 MAS degradado ($degr/4): $(grep -o '"status":"[a-z]*"' "$HFILE" | head -1)"
      if [ "$degr" -ge 4 ]; then
        degr=0
        log "degradação persistente — reiniciando servidor…"
        pkill -f "next-server" 2>/dev/null
        pkill -f "standalone/server.js" 2>/dev/null
        sleep 3
        if [ -f /home/z/my-project/.next/standalone/server.js ]; then
          # v3.9: sem DATABASE_URL exportada — otakuverse.runtime.json decide o modo
          # (Turso em produção; env externa sempre vence se definida)
          # v4.0: ENABLE_JOBS=1 SÓ local — no publicado o processo só serve requisições
          env -u DATABASE_URL ENABLE_JOBS=1 OTAKUVERSE_ROOT=/home/z/my-project PORT=3000 NODE_ENV=production \
            setsid node /home/z/my-project/.next/standalone/server.js >> /home/z/my-project/server.log 2>&1 &
          log "servidor de PRODUÇÃO reiniciado (degradado)"
        else
          setsid npm run dev >> /home/z/my-project/dev.log 2>&1 &
          log "servidor DEV reiniciado (build inexistente)"
        fi
        sleep 10
        curl -s -o /dev/null --max-time 90 "http://localhost:3000/api/works?sort=popular&perPage=1" # aquece o pool pós-boot
        continue
      fi
      curl -s -o /dev/null --max-time 60 "http://localhost:3000/api/works?sort=popular&perPage=1" # reaquece o pool
      continue
    fi
    consec=0
    degr=0
    continue
  fi
  degr=0
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
    # v3.9: sem DATABASE_URL exportada — otakuverse.runtime.json decide o modo
    # v4.0: ENABLE_JOBS=1 SÓ local
    env -u DATABASE_URL ENABLE_JOBS=1 OTAKUVERSE_ROOT=/home/z/my-project PORT=3000 NODE_ENV=production \
      setsid node /home/z/my-project/.next/standalone/server.js >> /home/z/my-project/server.log 2>&1 &
    log "servidor de PRODUÇÃO reiniciado"
  else
    setsid npm run dev >> /home/z/my-project/dev.log 2>&1 &
    log "servidor DEV reiniciado (build de produção inexistente)"
  fi
done
