#!/bin/sh
# Entrypoint da API em produção.
# - migrate: idempotente/aditivo (CREATE TABLE IF NOT EXISTS + colunas novas);
#   roda SEMPRE para aplicar mudanças de schema a cada deploy.
# - seed (dados iniciais): roda só na PRIMEIRA inicialização, controlado por um
#   marcador gravado no volume persistente de uploads.
set -e

echo "[start] aplicando migrações..."
node src/db/migrate.js

SEED_MARK="/app/api/uploads/.seeded"
if [ ! -f "$SEED_MARK" ]; then
  echo "[start] primeira inicialização — populando dados iniciais (seed)..."
  node src/db/seed.js
  touch "$SEED_MARK"
else
  echo "[start] seed já executado anteriormente — pulando."
fi

echo "[start] subindo o servidor..."
exec node src/server.js
