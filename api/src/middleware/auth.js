// Autenticação de admin via JWT em cookie httpOnly.
const jwt = require('jsonwebtoken');
const config = require('../config');

function assinarToken(admin) {
  return jwt.sign(
    { id: admin.id, email: admin.email, nome: admin.nome },
    config.jwtSecret,
    { expiresIn: config.jwtExpiraHoras + 'h' }
  );
}

function opcoesCookie() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    maxAge: config.jwtExpiraHoras * 60 * 60 * 1000,
    path: '/',
  };
}

// Middleware: exige um admin autenticado. Responde 401 se não houver sessão válida.
function requireAdmin(req, res, next) {
  const token = req.cookies ? req.cookies[config.cookieName] : null;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.admin = jwt.verify(token, config.jwtSecret);
    next();
  } catch (e) {
    res.status(401).json({ erro: 'Sessão inválida ou expirada' });
  }
}

module.exports = { assinarToken, opcoesCookie, requireAdmin };
