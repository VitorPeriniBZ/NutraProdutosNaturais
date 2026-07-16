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
const { anexarBadges, definirBadges } = require('../lib/produtoBadges');

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
    descricao: (body.descricao ? String(body.descricao).trim().slice(0, 500) : null) || null,
    preco: toNumOrNull(body.preco),
    ativo: toBool01(body.ativo, 1),
    disponivel: toBool01(body.disponivel, 1),
    destaque: toBool01(body.destaque, 0),
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
  if (!rows[0]) return null;
  await anexarBadges(rows);
  return rows[0];
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
    await anexarBadges(itens);
    res.json({ total: itens.length, itens });
  } catch (err) { next(err); }
});

router.post('/produtos', async (req, res, next) => {
  try {
    const d = dadosProduto(req.body);
    if (!d.nome) return res.status(400).json({ erro: 'O nome do produto é obrigatório' });
    const r = await db.run(
      `INSERT INTO produtos (nome, categoria_id, emoji, imagem_url, descricao, preco, ativo, disponivel, destaque, ordem, grama_min, grama_step, grama_max)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [d.nome, d.categoria_id, d.emoji, d.imagem_url, d.descricao, d.preco, d.ativo, d.disponivel, d.destaque, d.ordem, d.grama_min, d.grama_step, d.grama_max]
    );
    await definirBadges(r.insertId, req.body.badge_ids);
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
      `UPDATE produtos SET nome=?, categoria_id=?, emoji=?, imagem_url=?, descricao=?, preco=?, ativo=?, disponivel=?, destaque=?, ordem=?,
              grama_min=?, grama_step=?, grama_max=?, atualizado_em=CURRENT_TIMESTAMP
        WHERE id=?`,
      [d.nome, d.categoria_id, d.emoji, d.imagem_url, d.descricao, d.preco, d.ativo, d.disponivel, d.destaque, d.ordem, d.grama_min, d.grama_step, d.grama_max, id]
    );
    if (req.body.badge_ids !== undefined) await definirBadges(id, req.body.badge_ids);
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

// ───────────────────────── Badges ─────────────────────────
router.get('/badges', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT b.id, b.nome, b.ordem, COUNT(pb.produto_id) AS total
         FROM badges b
         LEFT JOIN produto_badges pb ON pb.badge_id = b.id
         GROUP BY b.id, b.nome, b.ordem
         ORDER BY b.ordem ASC, b.nome ASC`,
      []
    );
    res.json(rows.map((r) => ({ ...r, total: Number(r.total) })));
  } catch (err) { next(err); }
});

router.post('/badges', async (req, res, next) => {
  try {
    const nome = String(req.body.nome || '').trim().slice(0, 80);
    if (!nome) return res.status(400).json({ erro: 'O nome da badge é obrigatório' });
    const ordem = toIntOrNull(req.body.ordem) ?? 0;
    const dup = await db.query('SELECT id FROM badges WHERE nome = ?', [nome]);
    if (dup.length) return res.status(409).json({ erro: 'Já existe uma badge com esse nome' });
    const r = await db.run('INSERT INTO badges (nome, ordem) VALUES (?, ?)', [nome, ordem]);
    const rows = await db.query('SELECT * FROM badges WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

router.put('/badges/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    const nome = String(req.body.nome || '').trim().slice(0, 80);
    if (!nome) return res.status(400).json({ erro: 'O nome da badge é obrigatório' });
    const ordem = toIntOrNull(req.body.ordem) ?? 0;
    const dup = await db.query('SELECT id FROM badges WHERE nome = ? AND id <> ?', [nome, id]);
    if (dup.length) return res.status(409).json({ erro: 'Já existe outra badge com esse nome' });
    const r = await db.run('UPDATE badges SET nome=?, ordem=? WHERE id=?', [nome, ordem, id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Badge não encontrada' });
    const rows = await db.query('SELECT * FROM badges WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) { next(err); }
});

router.delete('/badges/:id', async (req, res, next) => {
  try {
    const id = toIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ erro: 'ID inválido' });
    // A relação em produto_badges é removida em cascata (ON DELETE CASCADE).
    const r = await db.run('DELETE FROM badges WHERE id = ?', [id]);
    if (!r.affectedRows) return res.status(404).json({ erro: 'Badge não encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ───────────────────────── Upload de imagem ─────────────────────────
// Extensão SEMPRE derivada do mimetype validado (allowlist), nunca do nome
// enviado pelo cliente — impede salvar, ex., um ".html" que o /uploads
// serviria como HTML executável (XSS armazenado).
const MIME_EXT = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};
fs.mkdirSync(config.uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = MIME_EXT[file.mimetype] || '.jpg';
    cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (MIME_EXT[file.mimetype]) cb(null, true);
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
