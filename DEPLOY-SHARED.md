# Deploy na Hospedagem Compartilhada Hostinger (hPanel / cPanel, sem Docker)

Guia para subir o projeto num plano de hospedagem compartilhada da Hostinger,
usando o **"Node.js"/"Setup Node.js App"** (Passenger) e o **MySQL** do painel —
sem Docker, sem acesso root. Não há Postgres nem containers aqui, por isso usamos
MySQL (o mesmo código funciona: basta `DB_CLIENT=mysql`).

## 1. Criar o banco MySQL

No hPanel: **Bancos de Dados → MySQL**.
1. Crie um banco (ex.: `usuario_nutra`).
2. Crie um usuário MySQL e uma senha forte.
3. Associe o usuário ao banco com **todos os privilégios**.
4. Anote: host (geralmente `localhost`), nome do banco, usuário e senha.

## 2. Enviar os arquivos

No **Gerenciador de Arquivos** (ou via Git, se o plano tiver), envie a pasta do
projeto para uma pasta fora do `public_html`, por exemplo `~/nutra` contendo as
subpastas `api/`, `site/` e `admin/`.

## 3. Criar a aplicação Node.js

No hPanel: **Avançado → Node.js** (ou "Setup Node.js App").
- **Node.js version**: 20 ou superior.
- **Application mode**: Production.
- **Application root**: `nutra/api` (a pasta onde está o `package.json`).
- **Application URL**: o domínio/subdomínio do site (ex.: `nutraprodutosnaturais.com.br`).
- **Application startup file**: `src/server.js`.

Clique em **Create**. O painel cria um ambiente virtual Node.

## 4. Variáveis de ambiente

Ainda na tela da aplicação Node.js, adicione as variáveis (botão "Add Variable"):

| Variável | Valor |
|---|---|
| `DB_CLIENT` | `mysql` |
| `MYSQL_HOST` | `localhost` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_USER` | o usuário criado no passo 1 |
| `MYSQL_PASSWORD` | a senha do passo 1 |
| `MYSQL_DATABASE` | o banco do passo 1 |
| `SERVE_STATIC` | `true` |
| `JWT_SECRET` | um valor aleatório longo (veja abaixo) |
| `COOKIE_SECURE` | `true` (com HTTPS ativo) |
| `ADMIN_NOME` | seu nome |
| `ADMIN_EMAIL` | seu e-mail de login |
| `ADMIN_PASSWORD` | senha do admin |

Para gerar o `JWT_SECRET`, rode no seu computador:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

> Alternativa: em vez de cadastrar variável por variável, você pode criar um
> arquivo `api/.env` (baseado no `api/.env.example`) com esses mesmos valores — a
> aplicação lê os dois.

## 5. Instalar dependências e preparar o banco

Na tela da aplicação Node.js:
1. Clique em **Run NPM Install** (instala as dependências).
2. Use o campo **"Run JS script"** para rodar `setup` (equivale a criar as tabelas
   e popular os produtos + admin). Se o painel não tiver esse campo, abra o
   **Terminal** do hPanel, ative o ambiente (o painel mostra o comando
   `source .../bin/activate`) e rode:
   ```bash
   cd ~/nutra/api
   npm run setup
   ```

## 6. Iniciar / reiniciar

Clique em **Restart** na aplicação Node.js. O Passenger passa a servir o site no
domínio configurado. Teste: `https://seudominio.com.br/api/health` deve responder
`{"ok":true,"db":"mysql"}`.

- Site público: `https://seudominio.com.br/`
- Painel: `https://seudominio.com.br/admin/login.html`

## 7. HTTPS

No hPanel: **Segurança → SSL** e ative o certificado gratuito (AutoSSL/Let's
Encrypt) para o domínio. Depois confirme que `COOKIE_SECURE=true`.

## Atualizações e manutenção

- **Atualizar o site**: reenvie os arquivos alterados (ou `git pull` pelo Terminal)
  e clique em **Restart** na aplicação Node.js. Se mudou algo no banco, rode
  `npm run migrate` no Terminal.
- **Trocar a senha do admin**: ajuste `ADMIN_*` e rode `npm run seed`.
- **Imagens enviadas** ficam em `~/nutra/api/uploads/` — inclua essa pasta no
  backup do painel.
- **Backup do banco**: use o **phpMyAdmin** do hPanel → Exportar.

## Limitações vs. VPS

- Sem Docker e sem Postgres (por isso MySQL).
- Menos controle de recursos; se o catálogo crescer muito ou o tráfego aumentar,
  migrar para a VPS (ver `DEPLOY-VPS.md`) é mais tranquilo — o código é o mesmo,
  muda só o `DB_CLIENT`/credenciais.
