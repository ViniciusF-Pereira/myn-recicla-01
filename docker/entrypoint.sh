#!/usr/bin/env bash
set -e
mkdir -p /data /app/outputs
# Gateway headless: Chromium roda DENTRO do container, sem janela no host.
node /app/docker/gateway-headless.mjs &
GATEWAY_PID=$!
trap 'kill $GATEWAY_PID 2>/dev/null || true' EXIT
# Espera o token existir antes de subir a API.
for i in $(seq 1 60); do
  [ -f "$MYN_GATEWAY_TOKEN_FILE" ] && break
  sleep 0.5
done
exec node /app/scripts/site-server.mjs
