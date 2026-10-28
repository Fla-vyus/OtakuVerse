#!/bin/bash
# Agendador PERMANENTE do OtakuVerse — tick a cada 30 min, 24/7 (v3.5).
#
# Como rodar (double-fork — sobrevive ao fim da sessão bash):
#   node -e "require('child_process').spawn('bash',['/home/z/my-project/scripts/scheduler-daemon.sh'],{detached:true,stdio:'ignore'}).unref()"
# (deploy.sh v3.5 já faz isso a cada deploy)
#
# Camadas de permanência:
#   - Este daemon dá tick via HTTP no servidor (/api/cron/tick?key=CRON_KEY)
#   - O servidor TAMBÉM tem um setInterval de 30min (instrumentation.ts)
#   - doRefresh() tem guarda anti-paralelismo → nunca roda duas vezes junto
#
# Regras:
#   - Se o servidor estiver em rebuild (.keepalive-pause), pula o tick
#   - Se o servidor estiver fora do ar, registra e segue — o keepalive
#     ressuscita o servidor e o PRÓXIMO tick (30min depois) executa;
#     o boot do servidor também dispara o refresh por conta própria.
set -u
PROJ=/home/z/my-project
LOG=$PROJ/scheduler.log
INTERVAL=1800  # 30 minutos

log() { echo "[$(date '+%F %T')] $*" >> "$LOG"; }
rotate() {
  local n
  n=$(wc -l < "$LOG" 2>/dev/null || echo 0)
  if [ "$n" -gt 3000 ]; then tail -n 1500 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"; fi
}

log "=== scheduler-daemon iniciado (pid $$) — tick a cada ${INTERVAL}s ==="
while true; do
  sleep "$INTERVAL"
  rotate
  if [ -f "$PROJ/.keepalive-pause" ]; then
    log "tick pulado — rebuild em andamento (.keepalive-pause)"
    continue
  fi
  KEY=$(sed -n 's/^CRON_KEY=//p' "$PROJ/.env" 2>/dev/null | head -1 | tr -d '\r\n')
  if [ -z "$KEY" ]; then
    log "tick pulado — CRON_KEY ausente no .env"
    continue
  fi
  RESP=$(curl -s -m 300 "http://127.0.0.1:3000/api/cron/tick?key=${KEY}" 2>&1)
  log "tick: ${RESP:-sem resposta (servidor fora do ar?)}"
done
