# Site Nutra Produtos Naturais

Site institucional + catálogo com carrinho (fechamento por WhatsApp) e painel
administrativo para gerenciar os produtos sem editar código.

## Estrutura do projeto

```
/                     índice antigo (monolito) — ainda no ar no GitHub Pages até o deploy da Fase 4
/site                 frontend público (servido pela API na mesma origem)
  index.html
  css/estilo.css
  js/catalogo.js      busca os produtos na API (antes era o array ALL_PRODS embutido)
  js/ui.js            vídeo, scroll reveal, contadores, menu hambúrguer
  js/carrinho.js      carrinho em localStorage (inalterado)
/admin                painel administrativo (Fase 2)
/api                  backend Node.js + Express
  src/
    server.js         sobe a API e serve /site e /admin na mesma origem
    config.js         lê variáveis de ambiente (.env)
    db/
      index.js        camada de banco com 2 drivers: sqlite (dev) | mysql (prod)
      schema.sqlite.sql / schema.mysql.sql
      migrate.js      cria as tabelas
      seed.js         popula categorias + 151 produtos (e admin inicial se configurado)
      produtos-seed.json
    routes/
      produtos.js     GET /api/produtos  (público)
      categorias.js   GET /api/categorias (público)
```

## Banco de dados: um código, dois bancos

O mesmo código roda em **SQLite** (desenvolvimento local, sem instalar nada — usa
o SQLite embutido do Node 22+) ou **MySQL/MariaDB** (produção na Hostinger, seja
VPS ou hospedagem compartilhada). A escolha é feita pela variável `DB_CLIENT` no
`.env`. Assim o projeto funciona nos dois planos da Hostinger sem reescrever nada.

## Rodando localmente (SQLite, zero configuração)

Requisitos: Node.js 20+ (recomendado 22+).

```bash
cd api
npm install
cp .env.example .env          # o padrão já usa SQLite
npm run setup                 # cria as tabelas e popula os 151 produtos
npm start                     # sobe em http://localhost:3000
```

Abra `http://localhost:3000/` — o site público é servido pela própria API e o
catálogo carrega os produtos via `GET /api/produtos`.

Endpoints úteis:
- `GET /api/health` — status + banco em uso
- `GET /api/produtos?categoria=&busca=&pagina=&por_pagina=`
- `GET /api/categorias`

## Produção (MySQL)

No `.env`, defina `DB_CLIENT=mysql` e as credenciais `MYSQL_*`. Depois:

```bash
npm run migrate   # cria as tabelas no MySQL
npm run seed      # popula categorias + produtos + admin inicial
npm start
```

Guias de deploy prontos para os dois planos da Hostinger:
- **VPS** (Docker + MySQL + Nginx + HTTPS): [`DEPLOY-VPS.md`](DEPLOY-VPS.md) + `docker-compose.yml`
- **Compartilhada** (cPanel/hPanel, Node.js Selector + MySQL, sem Docker): [`DEPLOY-SHARED.md`](DEPLOY-SHARED.md)

O mesmo código roda nos dois — muda só `DB_CLIENT` e as credenciais. Os dois
backends (SQLite local e MySQL) foram testados de ponta a ponta.

## Status das fases

- [x] **Fase 1** — Backend + banco + catálogo consumindo a API (site idêntico ao atual)
- [x] **Fase 2** — Login + painel admin (CRUD de produtos/categorias + upload de imagem)
- [x] **Fase 3** — Responsividade completa (breakpoints unificados 480/768/1024)
- [x] **Fase 4** — Artefatos e guias de deploy prontos (VPS e compartilhada); falta você contratar a hospedagem e rodar o passo a passo

## Painel administrativo

Acesse em `/admin/login.html` (ex.: `http://localhost:3000/admin/login.html`).

O login usa o admin criado pelo `seed` a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD`
no `.env`. Para criar/trocar o admin, ajuste essas variáveis e rode `npm run seed`
(a senha é guardada com hash bcrypt; a tabela `admins` já está pronta para mais de
um usuário no futuro).

Recursos do painel:
- Listar/buscar/filtrar produtos (por categoria e por status ativo/inativo)
- Criar, editar e excluir produtos (com nome, categoria, emoji, imagem, preço
  opcional, ativo/inativo, ordem e overrides de gramagem)
- Upload de imagem do produto (salva em `api/uploads/`, servida em `/uploads/...`)
- CRUD de categorias (bloqueia exclusão de categoria com produtos)
- Sessão via cookie httpOnly (JWT), com rate limit no login
- Responsivo: no celular a tabela vira cards empilhados
