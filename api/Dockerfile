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

# Uploads persistem em volume (ver compose); garante que a pasta exista e
# pertença ao usuário "node" (a app não roda como root — ver USER abaixo).
RUN mkdir -p /app/api/uploads && chown -R node:node /app/api/uploads

# curl é usado pelo healthcheck do docker-compose
RUN apk add --no-cache curl

WORKDIR /app/api
ENV NODE_ENV=production
EXPOSE 3000

# Princípio do menor privilégio: não rodar como root.
USER node

# migrate/seed via start.sh (migrate sempre; seed só na 1ª inicialização),
# depois sobe o servidor.
CMD ["sh", "./start.sh"]
