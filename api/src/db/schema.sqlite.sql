-- Schema SQLite (desenvolvimento local via node:sqlite)
CREATE TABLE IF NOT EXISTS categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT NOT NULL UNIQUE,
  emoji  TEXT,
  ordem  INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS produtos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT NOT NULL,
  categoria_id  INTEGER REFERENCES categorias(id),
  emoji         TEXT,
  imagem_url    TEXT,
  descricao     TEXT,                 -- texto curto exibido na seção de destaques
  preco         REAL,                 -- opcional; NÃO exibido publicamente (reservado p/ futuro)
  ativo         INTEGER NOT NULL DEFAULT 1,   -- visível no site
  disponivel    INTEGER NOT NULL DEFAULT 1,   -- pode adicionar ao carrinho (0 = "Indisponível")
  destaque      INTEGER NOT NULL DEFAULT 0,   -- aparece na seção "Produtos em destaque" da home
  ordem         INTEGER DEFAULT 0,
  grama_min     INTEGER,              -- override; NULL usa o padrão global (100)
  grama_step    INTEGER,              -- override; NULL usa o padrão global (50)
  grama_max     INTEGER,              -- override; NULL usa o padrão global (5000)
  criado_em     TEXT DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Selos/badges (ex.: Vegano, Orgânico, Sem Glúten). Estilo visual é único no site.
CREATE TABLE IF NOT EXISTS badges (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  nome   TEXT NOT NULL UNIQUE,
  ordem  INTEGER DEFAULT 0
);

-- Relação N:N entre produtos e badges.
CREATE TABLE IF NOT EXISTS produto_badges (
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  badge_id   INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_pb_badge ON produto_badges(badge_id);

CREATE TABLE IF NOT EXISTS admins (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL UNIQUE,
  senha_hash   TEXT NOT NULL,
  ultimo_login TEXT,
  criado_em    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON produtos(ativo);

-- Configurações da loja editáveis pelo painel (chave/valor). O .env é só o
-- valor inicial/fallback; o que estiver aqui tem prioridade.
CREATE TABLE IF NOT EXISTS config_loja (
  chave TEXT PRIMARY KEY,
  valor TEXT
);
