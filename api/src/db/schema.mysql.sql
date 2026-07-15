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
  preco         DECIMAL(10,2),        -- opcional; NÃO exibido publicamente (reservado p/ futuro)
  ativo         TINYINT(1) NOT NULL DEFAULT 1,   -- visível no site
  disponivel    TINYINT(1) NOT NULL DEFAULT 1,   -- pode adicionar ao carrinho (0 = "Indisponível")
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

CREATE TABLE IF NOT EXISTS admins (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(160) NOT NULL,
  email        VARCHAR(200) NOT NULL UNIQUE,
  senha_hash   VARCHAR(255) NOT NULL,
  ultimo_login TIMESTAMP NULL,
  criado_em    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
