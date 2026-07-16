// Servidor da Nutra: expõe a API REST e (opcionalmente) serve o frontend
// estático (site público + painel admin) na mesma origem — assim não precisa
// de CORS nem de segundo servidor.
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const config = require('./config');

const produtosRouter = require('./routes/produtos');
const categoriasRouter = require('./routes/categorias');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do Nginx (VPS) / proxy da hospedagem

// Cabeçalhos de segurança. CSP desligada por padrão para não quebrar o
// frontend estático inline; o essencial (nosniff, no-referrer, frameguard) fica ativo.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// CORS só quando o frontend roda em outra origem (não é o padrão deste projeto).
if (config.corsOrigin) {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', config.corsOrigin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

// ── Healthcheck ──
app.get('/api/health', (req, res) => res.json({ ok: true, db: config.db.client }));

// ── Rotas públicas ──
app.use('/api/produtos', produtosRouter);
app.use('/api/categorias', categoriasRouter);

// ── Rotas de autenticação e admin (Fase 2 — montadas se os arquivos existirem) ──
for (const [rota, arquivo] of [
  ['/api/auth', './routes/auth'],
  ['/api/admin', './routes/admin'],
]) {
  if (fs.existsSync(path.join(__dirname, arquivo + '.js'))) {
    app.use(rota, require(arquivo));
  }
}

// ── Uploads de imagem (disco) ──
if (fs.existsSync(config.uploadDir)) {
  app.use(
    '/uploads',
    express.static(config.uploadDir, {
      maxAge: '7d',
      // Impede que o browser reinterprete o conteúdo (defesa extra além da
      // allowlist de extensão no upload).
      setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff'),
    })
  );
}

// ── Frontend estático ──
if (config.serveStatic) {
  if (fs.existsSync(config.adminDir)) {
    app.use('/admin', express.static(config.adminDir));
  }
  if (fs.existsSync(config.siteDir)) {
    app.use('/', express.static(config.siteDir));
  }
}

// ── 404 para rotas de API ──
app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

// ── Tratamento de erros ──
app.use((err, req, res, next) => {
  console.error('[erro]', err.message);
  if (res.headersSent) return next(err);
  const status = err.status || 500;
  res.status(status).json({ erro: status === 500 ? 'Erro interno' : err.message });
});

const server = app.listen(config.port, () => {
  console.log(`[nutra-api] ouvindo em http://localhost:${config.port} (db: ${config.db.client})`);
});

function shutdown() {
  console.log('\n[nutra-api] encerrando...');
  server.close(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = app;
