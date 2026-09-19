# Produção: HostGator (cPanel) com deploy por Git

O site em `https://nutraprodutosnaturais.com.br` roda em hospedagem compartilhada
da HostGator, onde **não é possível rodar Node** (sem terminal no cPanel e SSH só
por chave). Por isso a API Node/Express foi portada para **PHP + PDO**, mantendo
as mesmas 22 rotas e o mesmo JSON — o painel (`admin/`) e o front-end (`site/`)
são exatamente os mesmos arquivos deste repositório, sem uma linha alterada.

O código Node continua aqui e continua válido: o schema MySQL é o mesmo, então
migrar para um VPS um dia é só apontar o `.env` para o mesmo banco.

## Como atualizar o site

```
edita → git push → cPanel → Update from Remote → Deploy HEAD Commit
```

No cPanel: **Git™ Version Control → Manage** no repositório
`NutraProdutosNaturais` → aba **Pull or Deploy**.

O que o deploy faz está em `.cpanel.yml`, e ele **só copia arquivos**. Nada é
apagado, então estes sobrevivem a qualquer deploy:

| arquivo | o que é |
|---|---|
| `_app/config.php` | credenciais do banco, criado pelo instalador |
| `uploads/*` | imagens enviadas pelo painel |
| `_app/tmp/*` | log de erro e controle de tentativas de login |

## Onde mexer para cada tipo de mudança

| quero mudar | mexo em |
|---|---|
| produtos, categorias, selos, WhatsApp, horário | **no painel**, não no código |
| textos, seções e HTML da home | `site/index.html` |
| cores, fontes, layout | `site/css/estilo.css` |
| comportamento do catálogo/carrinho | `site/js/*.js` |
| painel administrativo | `admin/` |
| regras da API, validação, rotas | `php/_app/routes_*.php` |
| conexão, sessão, upload | `php/_app/{db,auth,http}.php` |

`site/index.html` é o template: o `php/index.php` substitui os `{{TOKENS}}`
(WhatsApp, endereço, JSON-LD) antes de servir. O deploy copia esse arquivo para
`_app/templates/index.tpl.html` — **não edite a cópia**, ela é sobrescrita.

## Rollback em 5 segundos

Apague o `index.php` pelo Gerenciador de Arquivos. O `DirectoryIndex` do
`.htaccess` faz o Apache voltar a servir o `index.html` estático na hora, e nada
se perde: o banco continua intacto e o painel segue acessível.

## Instalação do zero (outra conta / outro servidor)

1. cPanel → **Assistente de Banco de Dados**: crie banco e usuário com TODOS OS
   PRIVILÉGIOS (na HostGator o nome recebe um prefixo, ex.: `nutrapro_`)
2. Faça o deploy por Git (ou suba os arquivos manualmente)
3. Suba `ferramentas/instalar-b1009c44b5.php` para o `public_html`, abra no
   navegador, preencha os dados do banco e escolha o e-mail/senha do painel
4. **Apague o instalador** — por isso ele fica em `ferramentas/` e não em `php/`:
   o deploy nunca o coloca no ar sozinho

Detalhes completos do pacote PHP em `ferramentas/LEIA-ME-php.md`.

## Pegadinhas conhecidas deste servidor

- **mod_security**: recusa upload de PHP contendo `readfile()`. Por isso o
  `index.php` usa `echo file_get_contents(...)`.
- **Prefixo de banco**: nomes de banco e usuário precisam começar com o prefixo
  da conta cPanel.
- **WhatsApp**: o campo guarda só dígitos — escreva `5527996600444`, com o 55.
  Sem ele os links `wa.me` param de funcionar.
- **Trocar a senha do painel**: o painel não tem essa tela; use
  `trocar-senha-b1009c44b5.php`, que vai junto no deploy.
