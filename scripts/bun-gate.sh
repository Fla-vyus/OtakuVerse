#!/bin/bash
# Portão canônico de pré-publicação (v3.9.2+) + medição de memória v3.9.4.
# Contrato idêntico ao da plataforma: bun, env limpa, cwd=standalone.
# Mede o pico de RSS durante boot + warm-up — é o número que decide se o
# container da plataforma sobrevive (o incidente v3.9.3 foi pico 1165MB → OOM).
set -u
cd /home/z/my-project/.next/standalone || exit 1

pkill -f "bun server.js" 2>/dev/null
sleep 1

env -i PATH=/usr/local/bin:/usr/bin:/bin HOME=/home/z PORT=3999 NODE_ENV=production \
  bun server.js > /home/z/my-project/scripts/bun-gate.log 2>&1 &
BUN_PID=$!
echo "[gate] bun pid=$BUN_PID — amostrando RSS a cada 1s…"

MAX=0
for i in $(seq 1 40); do
  sleep 1
  R=$(ps -o rss= -p "$BUN_PID" 2>/dev/null | tr -d ' ')
  [ -z "$R" ] && continue
  MB=$((R / 1024))
  [ "$MB" -gt "$MAX" ] && MAX=$MB
  case $i in
    5|10|15|20|30|40) echo "[gate] ${i}s rss=${MB}MB" ;;
  esac
  # warm-up: health no 4s, works no 8s, sections no 12s, home no 16s
  if [ "$i" = 4 ];  then curl -s -o /dev/null -w "[gate] health  HTTP %{http_code} · %{time_total}s\n" --max-time 30 http://localhost:3999/api/health; fi
  if [ "$i" = 8 ];  then curl -s -o /dev/null -w "[gate] works   HTTP %{http_code} · %{time_total}s\n" --max-time 60 "http://localhost:3999/api/works?sort=popular&perPage=60"; fi
  if [ "$i" = 12 ]; then curl -s -o /dev/null -w "[gate] sections HTTP %{http_code} · %{time_total}s\n" --max-time 60 "http://localhost:3999/api/sections?part=core"; fi
  if [ "$i" = 16 ]; then curl -s -o /dev/null -w "[gate] home     HTTP %{http_code} · %{time_total}s · %{size_download}B\n" --max-time 60 http://localhost:3999/; fi
  if [ "$i" = 30 ]; then H=$(curl -s --max-time 15 http://localhost:3999/api/health); echo "[gate] health json: $(echo "$H" | head -c 320)"; fi
done

echo "[gate] ==============================="
echo "[gate] PICO DE RSS: ${MAX}MB (incidente v3.9.3: 1165MB → OOM)"
kill "$BUN_PID" 2>/dev/null
echo "[gate] events.log (standalone/data):"
tail -4 /home/z/my-project/.next/standalone/data/events.log 2>/dev/null
