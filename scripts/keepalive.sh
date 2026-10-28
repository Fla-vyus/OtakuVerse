#!/bin/bash
# Keepalive do OtakuVerse — se o /api/health não responder 2x seguidas,
# reinicia o servidor dev (npm run dev com heap cap). Roda via crontab a cada 5min.
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000/api/health)
if [ "$HEALTH" = "200" ]; then
  exit 0
fi
# segunda chance (transiente?)
sleep 15
HEALTH2=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 http://localhost:3000/api/health)
if [ "$HEALTH2" = "200" ]; then
  exit 0
fi
echo "[$(date '+%F %T')] health=$HEALTH/$HEALTH2 — reiniciando servidor" >> /home/z/my-project/keepalive.log
cd /home/z/my-project
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 3
nohup npm run dev >> /home/z/my-project/dev.log 2>&1 &
echo "[$(date '+%F %T')] servidor reiniciado pelo keepalive" >> /home/z/my-project/keepalive.log
