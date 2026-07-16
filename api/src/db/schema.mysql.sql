-- Schema MySQL / MariaDB (produção Hostinger: VPS ou compartilhada)
CREATE TABLE IF NOT EXISTS categorias (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  nome   VARCHAR(160) NOT NULL UNIQUE,
  emoji  VARCHAR(16),
  ordem  INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS produtos (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nome          VARCHAR(255) NOT NULL,
  categoria_id  INT,
  emoji         VARCHAR(16),
  imagem_url    VARCHAR(512),
  descricao     VARCHAR(500),         -- texto curto exibido na seção de destaques
  preco         DECIMAL(10,2),        -- opcional; NÃO exibido publicamente (reservado p/ futuro)
  ativo         TINYINT(1) NOT NULL DEFAULT 1,   -- visível no site
  disponivel    TINYINT(1) NOT NULL DEFAULT 1,   -- pode adicionar ao carrinho (0 = "Indisponível")
  destaque      TINYINT(1) NOT NULL DEFAULT 0,   -- aparece na seção "Produtos em destaque" da home
  ordem         INT DEFAULT 0,
  grama_min     INT,                  -- override; NULL usa o padrão global (100)
  grama_step    INT,                  -- override; NULL usa o padrão global (50)
  grama_max     INT,                  -- override; NULL usa o padrão global (5000)
  criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_produtos_categoria (categoria_id),
  INDEX idx_produtos_ativo (ativo),
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Selos/badges (ex.: Vegano, Orgânico, Sem Glúten). Estilo visual é único no site.
CREATE TABLE IF NOT EXISTS badges (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  nome  VARCHAR(80) NOT NULL UNIQUE,
  ordem INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Relação N:N entre produtos e badges.
CREATE TABLE IF NOT EXISTS produto_badges (
  produto_id INT NOT NULL,
  badge_id   INT NOT NULL,
  PRIMARY KEY (produto_id, badge_id),
  INDEX idx_pb_badge (badge_id),
  CONSTRAINT fk_pb_prod  FOREIGN KEY (produto_id) REFERENCES produtos(id) ON DELETE CASCADE,
  CONSTRAINT fk_pb_badge FOREIGN KEY (badge_id)   REFERENCES badges(id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admins (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(160) NOT NULL,
  email        VARCHAR(200) NOT NULL UNIQUE,
  senha_hash   VARCHAR(255) NOT NULL,
  ultimo_login TIMESTAMP NULL,
  criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Configurações da loja editáveis pelo painel (chave/valor). O .env é só o
-- valor inicial/fallback; o que estiver aqui tem prioridade.
CREATE TABLE IF NOT EXISTS config_loja (
  chave VARCHAR(64) PRIMARY KEY,
  valor TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
