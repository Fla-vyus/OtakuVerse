#!/bin/bash
# Auditoria de performance OtakuVerse — mede tempo (ms) e tamanho (bytes) de cada rota
# 2 passes por rota: primeiro = frio (compile/DB), segundo = quente (cache)
BASE="http://localhost:3000"
ROUTES=(
  "/"
  "/api/sections"
  "/api/hype"
  "/api/news"
  "/api/sales"
  "/api/magazines"
  "/api/releases"
  "/api/streaming"
  "/api/calendar"
  "/api/schedule"
  "/api/works?sort=popular&perPage=60"
  "/api/works/16498"
  "/api/status"
  "/api/health"
)
printf "%-38s %10s %10s %10s %10s\n" "ROTA" "p1_ms" "p1_KB" "p2_ms" "p2_KB"
for r in "${ROUTES[@]}"; do
  for pass in 1 2; do
    out=$(curl -s -o /tmp/perf_body -w "%{time_total} %{size_download}" --max-time 60 "$BASE$r")
    t=$(echo "$out" | awk '{printf "%.0f", $1*1000}')
    b=$(echo "$out" | awk '{printf "%.1f", $2/1024}')
    if [ $pass -eq 1 ]; then t1=$t; b1=$b; else t2=$t; b2=$b; fi
  done
  printf "%-38s %10s %10s %10s %10s\n" "$r" "$t1" "$b1" "$t2" "$b2"
done
