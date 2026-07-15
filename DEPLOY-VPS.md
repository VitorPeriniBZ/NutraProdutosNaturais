# Deploy na VPS Hostinger (Docker + MySQL + Nginx + HTTPS)

Guia para subir tudo numa VPS Ubuntu da Hostinger. A API roda em container, o
MySQL em outro container, e o Nginx do sistema faz o HTTPS e o proxy para a API.
O site público e o painel são servidos pela própria API (mesma origem).

> Tudo que precisa de terminal na VPS está aqui. Você acessa a VPS por SSH
> (a Hostinger mostra o IP, usuário e senha no hPanel → VPS).

## 0. Pré-requisitos

- Uma VPS Hostinger com Ubuntu 22.04+ (acesso root via SSH).
- Um domínio (ou subdomínio) apontando para o IP da VPS. No painel de DNS do
  domínio, crie um registro **A** para `seudominio.com.br` (e outro para
  `www`) com o IP da VPS.

## 1. Instalar Docker e Nginx

```bash
# conecte na VPS por SSH e rode:
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh          # instala Docker + Compose
apt install -y nginx certbot python3-certbot-nginx git
```

## 2. Baixar o projeto

```bash
cd /opt
git clone https://github.com/VitorPeriniBZ/Site-Nutra.git nutra
cd nutra
```

## 3. Configurar as variáveis de ambiente

```bash
cp .env.example .env
nano .env      # preencha as senhas, o JWT_SECRET, o ADMIN_EMAIL/ADMIN_PASSWORD
```

Gere o `JWT_SECRET` com:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))" 2>/dev/null \
  || openssl rand -hex 48
```

Deixe `COOKIE_SECURE=true` (o site vai ter HTTPS).

## 4. Subir os containers

```bash
docker compose up -d --build
docker compose logs -f api      # acompanhe; deve criar tabelas, popular e "ouvindo em ..."
```

A API sobe cria as tabelas, popula os 151 produtos e cria o admin inicial
(idempotente — pode rodar de novo sem duplicar). Ela escuta em `127.0.0.1:3000`
(só local; o Nginx expõe para a internet).

Teste local na VPS: `curl http://127.0.0.1:3000/api/health` → `{"ok":true,"db":"mysql"}`.

## 5. Configurar o Nginx

```bash
cp nginx/nutra.conf /etc/nginx/sites-available/nutra
# troque "seudominio.com.br" pelo seu domínio dentro do arquivo:
nano /etc/nginx/sites-available/nutra
ln -s /etc/nginx/sites-available/nutra /etc/nginx/sites-enabled/nutra
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

Agora `http://seudominio.com.br` já deve abrir o site.

## 6. Ativar HTTPS (Let's Encrypt)

```bash
certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

O Certbot ajusta o Nginx sozinho e renova o certificado automaticamente.
Pronto: `https://seudominio.com.br` (site), `https://seudominio.com.br/admin/login.html` (painel).

## Operação do dia a dia

```bash
# ver logs
docker compose logs -f api

# atualizar o projeto após um git push
cd /opt/nutra && git pull && docker compose up -d --build

# backup do banco
docker compose exec db mysqldump -u root -p"$MYSQL_ROOT_PASSWORD" nutra > backup-$(date +%F).sql

# backup das imagens enviadas (volume "uploads")
docker run --rm -v nutra_uploads:/u -v "$PWD":/b alpine tar czf /b/uploads-$(date +%F).tar.gz -C /u .

# trocar a senha do admin: edite ADMIN_* no .env e rode o seed
docker compose exec api npm run seed
```

> As imagens de produto ficam no volume Docker `uploads` (no disco da VPS).
> Configure o snapshot/backup da Hostinger e/ou os comandos acima num cron.

## Se preferir não usar Docker

A API roda com Node puro também: `cd api && npm ci && npm run setup && npm start`
(com um MySQL instalado na VPS e o `.env` da pasta `api/` apontando para ele).
Use um gerenciador de processo como `pm2` para manter no ar. O Nginx (passos 5–6)
é igual.
