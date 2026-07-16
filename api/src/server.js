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
const configRouter = require('./routes/config');

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
app.use('/api/config', configRouter);

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

// ── Injeção server-side dos dados da loja no index.html ──
// Substitui placeholders {{TOKEN}} pelos valores da config a cada request,
// mantendo o SEO (meta/JSON-LD chegam prontos no HTML, sem depender de JS).
const { configPublica } = configRouter;
const INDEX_PATH = path.join(config.siteDir, 'index.html');
let indexTemplate = null;

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
  ));
}
// JSON seguro para embutir em <script> (evita fechar a tag por engano).
function jsonParaScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function montarJsonLd(s) {
  const [locality, region] = String(s.city).split(/\s*[-–]\s*/);
  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: s.name,
    description: 'Loja de produtos naturais: orgânicos, chás e ervas, alimentos a granel e suplementação.',
    image: 'https://www.nutraprodutosnaturais.com.br/og-image.jpg',
    url: 'https://www.nutraprodutosnaturais.com.br/',
    telephone: '+' + s.whatsapp,
    priceRange: '$$',
    address: {
      '@type': 'PostalAddress',
      streetAddress: s.address,
      addressLocality: locality || s.city,
      addressRegion: region || '',
      postalCode: s.cep,
      addressCountry: 'BR',
    },
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '18:00',
    }],
    sameAs: [s.instagram],
  };
}

function renderIndex(req, res, next) {
  try {
    if (indexTemplate === null) indexTemplate = fs.readFileSync(INDEX_PATH, 'utf8');
    const pub = configPublica();
    const tokens = {
      STORE_NAME: escHtml(pub.name),
      STORE_WHATSAPP: escHtml(pub.whatsapp),
      STORE_ADDRESS: escHtml(pub.address),
      STORE_CITY: escHtml(pub.city),
      STORE_CEP: escHtml(pub.cep),
      STORE_HOURS: escHtml(pub.hours),
      INSTAGRAM_URL: escHtml(pub.instagram),
      JSONLD: jsonParaScript(montarJsonLd(config.store)),
      CONFIG_JSON: jsonParaScript(pub),
    };
    const html = indexTemplate.replace(/\{\{(\w+)\}\}/g, (m, k) => (
      Object.prototype.hasOwnProperty.call(tokens, k) ? tokens[k] : m
    ));
    res.type('html').send(html);
  } catch (err) {
    next(err);
  }
}

// ── Frontend estático ──
if (config.serveStatic) {
  if (fs.existsSync(config.adminDir)) {
    app.use('/admin', express.static(config.adminDir));
  }
  if (fs.existsSync(config.siteDir)) {
    // index.html passa pela injeção; demais assets pelo static (sem servir index).
    app.get(['/', '/index.html'], renderIndex);
    app.use('/', express.static(config.siteDir, { index: false }));
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
