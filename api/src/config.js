// Configuração central — lê variáveis de ambiente.
// Carrega um arquivo .env (se existir) sem depender de pacote externo, para
// funcionar tanto em VPS (Docker/systemd) quanto no "Node.js Selector" da
// hospedagem compartilhada da Hostinger (onde as envs vêm do painel).
const fs = require('fs');
const path = require('path');

function loadDotEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  text.split('\n').forEach((raw) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const eq = line.indexOf('=');
    if (eq === -1) return;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  });
}
loadDotEnv();

const env = process.env;
const bool = (v, def) => (v === undefined ? def : /^(1|true|yes|on)$/i.test(v));
const int = (v, def) => (v === undefined || v === '' ? def : parseInt(v, 10));

const config = {
  port: int(env.PORT, 3000),
  nodeEnv: env.NODE_ENV || 'development',

  // Banco: 'sqlite' (padrão, dev local, zero instalação) ou 'mysql' (produção Hostinger)
  db: {
    client: (env.DB_CLIENT || 'sqlite').toLowerCase(),
    sqliteFile: env.SQLITE_FILE || path.resolve(__dirname, '..', 'data', 'nutra.db'),
    mysql: {
      host: env.MYSQL_HOST || '127.0.0.1',
      port: int(env.MYSQL_PORT, 3306),
      user: env.MYSQL_USER || 'root',
      password: env.MYSQL_PASSWORD || '',
      database: env.MYSQL_DATABASE || 'nutra',
    },
  },

  // Servir o frontend estático (site público + painel) pela mesma origem da API
  serveStatic: bool(env.SERVE_STATIC, true),
  siteDir: env.SITE_DIR || path.resolve(__dirname, '..', '..', 'site'),
  adminDir: env.ADMIN_DIR || path.resolve(__dirname, '..', '..', 'admin'),

  // CORS: só necessário se o frontend for servido em outra origem (não é o caso padrão)
  corsOrigin: env.CORS_ORIGIN || '',

  // Uploads de imagem no disco
  uploadDir: env.UPLOAD_DIR || path.resolve(__dirname, '..', 'uploads'),
  maxUploadMb: int(env.MAX_UPLOAD_MB, 4),

  // Autenticação (usada na Fase 2)
  jwtSecret: env.JWT_SECRET || (env.NODE_ENV === 'production' ? '' : '82f9ff67cae68739e30cfff2a9e1965d3a81e6bafb3e4678036b2691267384a4'),
  jwtExpiraHoras: int(env.JWT_EXPIRA_HORAS, 12),
  cookieSecure: bool(env.COOKIE_SECURE, env.NODE_ENV === 'production'),
  cookieName: env.COOKIE_NAME || 'nutra_admin',

  // Admin inicial (semeado por seed.js se ainda não existir)
  admin: {
    nome: env.ADMIN_NOME || 'Administrador',
    email: env.ADMIN_EMAIL || '',
    senha: env.ADMIN_PASSWORD || '',
  },

  // Regras globais de gramagem (fallback quando o produto não define override)
  grama: {
    min: int(env.GRAMA_MIN, 100),
    step: int(env.GRAMA_STEP, 50),
    max: int(env.GRAMA_MAX, 5000),
  },

  // Dados da loja externalizados (antes "chumbados" no HTML/JS do frontend).
  // Expostos publicamente via GET /api/config e injetados no index.html no servidor.
  store: {
    name: env.STORE_NAME || 'Nutra Produtos Naturais',
    // Só dígitos — usado em links wa.me/<numero>
    whatsapp: (env.STORE_WHATSAPP || '5527996600444').replace(/\D/g, ''),
    address: env.STORE_ADDRESS || 'Av. Saturnino Rangel Mauro, 1947',
    city: env.STORE_CITY || 'Vila Velha - ES',
    cep: env.STORE_CEP || '29102-036',
    hours: env.STORE_HOURS || 'Seg-Sáb: 8h-18h',
    instagram: env.INSTAGRAM_URL || 'https://instagram.com/nutraprodutosnaturais',
    // Regras do carrinho (stepper de gramas no frontend)
    cart: {
      minGrams: int(env.CART_MIN_GRAMS, 100),
      stepGrams: int(env.CART_STEP_GRAMS, 50),
      maxGrams: int(env.CART_MAX_GRAMS, 5000),
    },
  },
};

// Em produção, exige um JWT_SECRET forte definido por env. Sem isso, tokens de
// admin poderiam ser forjados por qualquer um que conheça o padrão do código.
if (config.nodeEnv === 'production') {
  if (!config.jwtSecret || config.jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET ausente ou fraco em produção. Gere um segredo forte, ex.: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
    );
  }
}

module.exports = config;
