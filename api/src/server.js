// Servidor da Nutra: expõe a API REST e (opcionalmente) serve o frontend
// estático (site público + painel admin) na mesma origem — assim não precisa
// de CORS nem de segundo servidor.
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config');

const produtosRouter = require('./routes/produtos');
const categoriasRouter = require('./routes/categorias');
const badgesRouter = require('./routes/badges');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // atrás do Nginx (VPS) / proxy da hospedagem

// Cabeçalhos de segurança (helmet) com uma CSP sob medida para este frontend:
// - scripts/estilos inline são permitidos ('unsafe-inline') porque o HTML usa
//   handlers inline (onclick="") e estilos inline;
// - imagens: próprio domínio, data: (favicon/preview) e WhatsApp;
// - fontes do Google Fonts (CSS em googleapis, arquivos em gstatic).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        // Handlers inline (onclick="…") usados no HTML precisam disto — o
        // padrão do helmet é 'none', que os bloquearia.
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https://*.whatsapp.net'],
        mediaSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        formAction: ["'self'", 'https://wa.me'],
        // Removido: em dev via http forçaria o fetch de /api para https e
        // quebraria. Em produção o HTTPS já é garantido pelo Nginx.
        upgradeInsecureRequests: null,
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rate limit global para toda a API: 100 requisições por minuto por IP.
// (o login tem um limite próprio, mais estrito, em routes/auth.js)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Aguarde um instante e tente novamente.' },
});
app.use('/api', apiLimiter);

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
app.use('/api/badges', badgesRouter);

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

// Só abre a porta quando executado diretamente (node src/server.js). Quando
// importado (ex.: testes com supertest), exporta só o app, sem escutar.
if (require.main === module) {
  const server = app.listen(config.port, () => {
    console.log(`[nutra-api] ouvindo em http://localhost:${config.port} (db: ${config.db.client})`);
  });

  const shutdown = () => {
    console.log('\n[nutra-api] encerrando...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = app;
