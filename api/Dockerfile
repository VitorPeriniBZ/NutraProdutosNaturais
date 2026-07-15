# Imagem da API Nutra (inclui o frontend estático servido na mesma origem).
# Contexto de build = raiz do repositório (ver docker-compose.yml).
FROM node:22-alpine

WORKDIR /app

# Instala só as dependências de produção (cache eficiente)
COPY api/package*.json ./api/
RUN cd api && npm ci --omit=dev

# Copia o backend e o frontend (site público + painel admin)
COPY api ./api
COPY site ./site
COPY admin ./admin

# Uploads persistem em volume (ver compose); garante que a pasta exista
RUN mkdir -p /app/api/uploads

WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000

# Cria/atualiza tabelas e popula (idempotente) e então sobe o servidor.
CMD ["sh", "-c", "node src/db/migrate.js && node src/db/seed.js && node src/server.js"]
