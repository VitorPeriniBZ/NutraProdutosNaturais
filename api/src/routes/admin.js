// Rotas protegidas do painel admin (exigem sessão de admin).
// Produtos:   GET/POST /produtos, PUT/DELETE /produtos/:id
// Categorias: GET/POST /categorias, PUT/DELETE /categorias/:id
// Upload:     POST /upload-imagem
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const db = require('../db');
const config = require('../config');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas abaixo exigem autenticação.
router.use(requireAdmin);

// ───────────────────────── Helpers ─────────────────────────
function toIntOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}
function toNumOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}
function toBool01(v, def = 1) {
  if (v === undefined || v === null || v === '') return def;
  return /^(1|true|yes|on)$/i.test(String(v)) || v === true ? 1 : 0;
}

function dadosProduto(body) {
  const nome = String(body.nome || '').trim();
  return {
    nome,
    categoria_id: toIntOrNull(body.categoria_id),
    emoji: (body.emoji ? String(body.emoji).trim() : null) || null,
    imagem_url: (body.imagem_url ? String(body.imagem_url).trim() : null) || null,
    preco: toNumOrNull(body.preco),
    ativo: toBool01(body.ativo, 1),
    disponivel: toBool01(body.disponivel, 1),
    ordem: toIntOrNull(body.ordem) ?? 0,
    grama_min: toIntOrNull(body.grama_min),
    grama_step: toIntOrNull(body.grama_step),
    grama_max: toIntOrNull(body.grama_max),
  };
}

async function buscarProduto(id) {
  const rows = await db.query(
    `SELECT p.*, c.nome AS categoria
       FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
      WHERE p.id = ?`,
    [id]
  );
  return rows[0] || null;
}

// ───────────────────────── Produtos ─────────────────────────
router.get('/produtos', async (req, res, next) => {
  try {
    const busca = String(req.query.busca || '').trim().toLowerCase();
    const categoriaId = toIntOrNull(req.query.categoria_id);
    const status = String(req.query.status || 'todos'); // todos | ativo | inativo

    const where = [];
    const params = [];
    if (busca) { where.push('LOWER(p.nome) LIKE ?'); params.push('%' + busca + '%'); }
    if (categoriaId) { where.push('p.categoria_id = ?'); params.push(categoriaId); }
    if (status === 'ativo') where.push('p.ativo = 1');
    else if (status === 'inativo') where.push('p.ativo = 0');
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const itens = await db.query(
      `SELECT p.*, c.nome AS categoria
         FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id
         ${whereSql}
         ORDER BY p.ordem ASC, p.id ASC`,
      params
    );
    res.json({ total: itens.length, itens });
  } catch (err) { next(err); }
});

router.post('/produtos', async (req, res, next) => {
  try {
    const d = dadosProduto(req.body);
    if (!d.nome) return res.status(400).json({ erro: 'O nome do produto é obrigatório' });
    const r = await db.run(
      `INSERT INTO produtos (nome, categoria_id, emoji, imagem_url, preco, ativo, disponivel, ordem, grama_min, grama_step, grama_max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nome, d.categoria_id, d.emoji, d.imagem_url, d.preco, d.ativo, d.disponivel, d.ordem, d.grama_min, d.grama_step, d.grama_max]
    );
    res.status(201).json(await buscarProduto(r.insertId));
  } catch (err) { next(err); }
});

router.put('/produtos/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const existente = await buscarProduto(id);
    if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });
    const d = dadosProduto(req.body);
    if (!d.nome) return res.status(400).json({ erro: 'O nome do produto é obrigatório' });
    await db.run(
      `UPDATE produtos SET nome=?, categoria_id=?, emoji=?, imagem_url=?, preco=?, ativo=?, disponivel=?, ordem=?,
              grama_min=?, grama_step=?, grama_max=?, atualizado_em=CURRENT_TIMESTAMP
        WHERE id=?`,
      [d.nome, d.categoria_id, d.emoji, d.imagem_url, d.preco, d.ativo, d.disponivel, d.ordem, d.grama_min, d.grama_step, d.grama_max, id]
    );
    res.json(await buscarProduto(id));
  } catch (err) { next(err); }
});

router.delete('/produtos/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const r = await db.run('DELETE FROM produtos WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Produto não encontrado' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ───────────────────────── Categorias ─────────────────────────
router.get('/categorias', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT c.id, c.nome, c.emoji, c.ordem,
              COUNT(p.id) AS total,
              COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total_ativos
         FROM categorias c LEFT JOIN produtos p ON p.categoria_id = c.id
         GROUP BY c.id, c.nome, c.emoji, c.ordem
         ORDER BY c.ordem ASC, c.nome ASC`,
      []
    );
    res.json(rows.map((r) => ({ ...r, total: Number(r.total), total_ativos: Number(r.total_ativos) })));
  } catch (err) { next(err); }
});

router.post('/categorias', async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'O nome da categoria é obrigatório' });
    const emoji = (req.body.emoji ? String(req.body.emoji).trim() : null) || null;
    const ordem = toIntOrNull(req.body.ordem) ?? 0;
    const dup = await db.query('SELECT id FROM categorias WHERE nome = ?', [nome]);
    if (dup.length) return res.status(409).json({ erro: 'Já existe uma categoria com esse nome' });
    const r = await db.run('INSERT INTO categorias (nome, emoji, ordem) VALUES (?, ?, ?)', [nome, emoji, ordem]);
    const rows = await db.query('SELECT * FROM categorias WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/categorias/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const nome = String(req.body.nome || '').trim();
    if (!nome) return res.status(400).json({ erro: 'O nome da categoria é obrigatório' });
    const emoji = (req.body.emoji ? String(req.body.emoji).trim() : null) || null;
    const ordem = toIntOrNull(req.body.ordem) ?? 0;
    const dup = await db.query('SELECT id FROM categorias WHERE nome = ? AND id <> ?', [nome, id]);
    if (dup.length) return res.status(409).json({ erro: 'Já existe outra categoria com esse nome' });
    const r = await db.run('UPDATE categorias SET nome=?, emoji=?, ordem=? WHERE id=?', [nome, emoji, ordem, id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Categoria não encontrada' });
    const rows = await db.query('SELECT * FROM categorias WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/categorias/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const usados = await db.query('SELECT COUNT(*) AS n FROM produtos WHERE categoria_id = ?', [id]);
    if (Number(usados[0].n) > 0) {
      return res.status(409).json({ erro: `Não é possível excluir: ${usados[0].n} produto(s) usam essa categoria. Reatribua-os antes.` });
    }
    const r = await db.run('DELETE FROM categorias WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Categoria não encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ───────────────────────── Upload de imagem ─────────────────────────
fs.mkdirSync(config.uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^.a-z0-9]/g, '');
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + (ext || '.jpg'));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpe?g|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Formato inválido: envie uma imagem (JPG, PNG, WEBP, GIF ou AVIF)'));
  },
});

router.post('/upload-imagem', (req, res) => {
  upload.single('imagem')(req, res, (err) => {
    if (err) return res.status(400).json({ erro: err.message });
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    res.status(201).json({ url: '/uploads/' + req.file.filename });
  });
});

module.exports = router;
