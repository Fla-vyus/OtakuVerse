#!/bin/bash
# Inicia o dev server e espera ficar pronto (mesma sessão bash — o sandbox mata processos destacados)
cd /home/z/my-project
if curl -s -o /dev/null -m 2 http://localhost:3000/; then
  echo "server: já rodando"
else
  (bun run dev > /tmp/dev-out.log 2>&1 &)
  for i in $(seq 1 40); do
    sleep 1
    if curl -s -o /dev/null -m 2 http://localhost:3000/; then
      echo "server: pronto (${i}s)"
      exit 0
    fi
  done
  echo "server: FALHOU"
  tail -20 /tmp/dev-out.log
  exit 1
fi
