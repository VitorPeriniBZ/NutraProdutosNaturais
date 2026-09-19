# Nutra — API em PHP + painel administrativo

Este pacote faz o painel `/admin` funcionar na hospedagem que você já tem, sem
Node e sem custo adicional. A API Node/Express foi portada para PHP mantendo
**as mesmas 22 rotas, os mesmos nomes de campo e o mesmo formato de JSON** —
por isso o painel (`admin/`) e o catálogo do site continuam exatamente os
mesmos arquivos, sem uma linha alterada.

Requisitos: PHP 7.4+ (o servidor tem 8.x) e MySQL/MariaDB. Ambos já existem na
conta do cPanel.

---

## Instalação (5 passos, ~10 minutos)

### 1. Criar o banco no cPanel

cPanel → **Bancos de dados → Assistente de Banco de Dados**:

1. nome do banco (o cPanel prefixa, ex.: `nutrapro_loja`)
2. usuário e senha — **anote a senha**
3. na tela de privilégios marque **TODOS OS PRIVILÉGIOS**

### 2. Subir os arquivos

cPanel → **Gerenciador de Arquivos** → entre em `public_html` →
**Carregar** → envie o `nutra-php.zip` → volte, clique com o botão direito no
zip → **Extract / Extrair**. Depois apague o zip.

> Isso **não muda o site**. Enquanto a instalação não terminar, o `index.php`
> entrega o `index.html` que já está no ar. A troca só acontece no passo 3.

### 3. Rodar o instalador

Abra no navegador:

```
https://nutraprodutosnaturais.com.br/instalar-b1009c44b5.php
```

Preencha os dados do banco (servidor = `localhost`) e escolha o e-mail e a
senha do painel. Ao enviar, ele cria as tabelas, insere as 6 categorias, os
**151 produtos**, os 6 selos e o seu usuário admin, e grava `_app/config.php`.

### 4. Apagar o instalador

Volte ao Gerenciador de Arquivos e **apague o `instalar-b1009c44b5.php`**.
Ele se recusa a rodar de novo depois de instalado, mas não custa remover.

### 5. Entrar no painel

```
https://nutraprodutosnaturais.com.br/admin/login.html
```

---

## Se algo der errado: rollback em 5 segundos

Apague o `index.php`. O Apache volta a servir o `index.html` estático na hora
(é o que a linha `DirectoryIndex index.php index.html` do `.htaccess` garante)
e nada é perdido — o banco continua intacto e o painel segue acessível.

---

## O que mudou no site público

A home passou a montar o catálogo a partir do banco, via `GET /api/produtos`.
Ou seja: o que você editar no painel aparece no site na mesma hora. Antes os
151 produtos estavam escritos dentro do HTML.

Também passou a existir o que o painel controla e o HTML antigo não tinha:
produto **inativo** (sai do site), **indisponível** (aparece, mas sem botão de
carrinho), **destaque** (entra em "Produtos em destaque"), selos por produto,
descrição, imagem e ordem.

---

## Onde cada coisa fica

```
public_html/
  index.php          home renderizada (injeta WhatsApp, endereço, JSON-LD)
  api.php            front controller de /api/*
  .htaccess          DirectoryIndex + rota /api + cabeçalhos de segurança
  admin/             painel — igual ao do repositório, sem alterações
  css/ js/           front-end do site (do diretório site/ do repositório)
  uploads/           imagens enviadas pelo painel
  _app/              código da API, config e template  (bloqueado pela web)
    config.php       credenciais do banco — criado pelo instalador
    templates/       index.tpl.html (o site/index.html com os {{TOKENS}})
    sql/             schema + os 151 produtos do seed
    tmp/             log de erro e controle de tentativas de login
  trocar-senha-b1009c44b5.php
```

O `_app/` tem um `.htaccess` que nega acesso pela web, e o `config.php` é um
arquivo `.php` que só faz `return [...]` — mesmo que o `.htaccess` fosse
ignorado, o servidor executaria em vez de exibir, então a senha do banco não
aparece. Testado: a resposta vem com 0 byte.

---

## Detalhes que valem saber

**WhatsApp precisa do 55.** O campo guarda só dígitos, então escreva
`5527996600444`. Se digitar `(27) 99660-0444`, o 55 se perde e os links
`wa.me` param de funcionar. Esse comportamento é o mesmo da API Node original.

**Trocar a senha do painel.** O painel não tem essa tela, então incluí o
`trocar-senha-b1009c44b5.php` — pede o e-mail e a senha atual. Pode deixar no
servidor ou apagar depois de usar.

**Forçar HTTPS.** No `.htaccess` há duas linhas comentadas para redirecionar
http → https. O certificado já está ativo, então vale descomentar.

**Upload de imagem.** Aceita JPG, PNG, WEBP, GIF e AVIF até 4 MB. O tipo é
verificado pelo conteúdo do arquivo (magic bytes), não pela extensão, e a
extensão salva é derivada do tipo real — um `.php` renomeado para `.jpg` é
recusado. O `/uploads` também tem um `.htaccess` que impede execução.

**Sessão.** Cookie de sessão do PHP, httpOnly, SameSite=Strict, 12 horas,
marcado como `Secure` quando o acesso é por HTTPS. Login tem limite de 10
tentativas por IP a cada 15 minutos.

**Voltar para Node algum dia.** Nada aqui apaga o projeto Node — ele segue em
`~/repositories/NutraProdutosNaturais`, e o banco MySQL é o mesmo schema. Se um
dia rodar Node nessa conta (ou num VPS), basta apontar o `.env` para este
banco: os dados que você cadastrar pelo painel PHP continuam válidos.

---

## O que foi testado antes da entrega

Contra MySQL/MariaDB real, com navegador de verdade:

- instalador: tabelas, 6 categorias, 151 produtos, 6 selos, admin, config
- as 22 rotas, incluindo os códigos de erro (400 / 401 / 404 / 409 / 429)
- login correto e incorreto; limite de tentativas barrando na 11ª
- CRUD de produtos, categorias e selos, com as travas (nome duplicado → 409,
  categoria em uso → 409)
- regras de visibilidade: inativo sai do site e continua no painel;
  indisponível continua no site; preço **nunca** aparece nas rotas públicas
- filtros do catálogo: categoria, busca, destaque e selo, com paginação
- upload de imagem válida (201) e de PHP disfarçado de `.jpg` (400, recusado)
- salvar configurações e ver o site refletir na hora
- painel no navegador: login, 151 linhas na tabela, busca, editar e salvar,
  abas Categorias / Badges / Configurações
- site no navegador: 151 produtos vindos da API, contadores por categoria,
  filtro por selo, adicionar ao carrinho
- fallback: antes de instalar, a home entrega o HTML antigo e a API responde
  503 — subir os arquivos não derruba nem altera o site
