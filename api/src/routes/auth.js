// Rotas de autenticação do painel admin.
// POST /api/auth/login   { email, senha } -> seta cookie de sessão
// POST /api/auth/logout  -> limpa a sessão
// GET  /api/auth/me      -> dados do admin logado (para o painel checar a sessão)
const express = require('express');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const db = require('../db');
const config = require('../config');
const { assinarToken, opcoesCookie, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Limita tentativas de login por IP (anti força-bruta).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const senha = String(req.body.senha || '');
    if (!email || !senha) return res.status(400).json({ erro: 'Informe email e senha' });

    const rows = await db.query('SELECT * FROM admins WHERE email = ?', [email]);
    const admin = rows[0];
    // bcrypt.compare mesmo sem admin evita vazar (por tempo) se o email existe.
    const hash = admin ? admin.senha_hash : '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(senha, hash);
    if (!admin || !ok) return res.status(401).json({ erro: 'Email ou senha incorretos' });

    await db.run('UPDATE admins SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?', [admin.id]);
    const token = assinarToken(admin);
    res.cookie(config.cookieName, token, opcoesCookie());
    res.json({ ok: true, admin: { nome: admin.nome, email: admin.email } });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie(config.cookieName, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', requireAdmin, (req, res) => {
  res.json({ admin: { nome: req.admin.nome, email: req.admin.email } });
});

module.exports = router;
