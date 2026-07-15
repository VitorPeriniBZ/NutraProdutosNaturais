// Rota pública de categorias.
// GET /api/categorias -> [{ id, nome, emoji, ordem, total }]  (total = produtos ativos)
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT c.id, c.nome, c.emoji, c.ordem,
              COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total
         FROM categorias c
         LEFT JOIN produtos p ON p.categoria_id = c.id
         GROUP BY c.id, c.nome, c.emoji, c.ordem
         ORDER BY c.ordem ASC, c.nome ASC`,
      []
    );
    // total vem como string em alguns drivers -> normaliza para número
    res.json(rows.map((r) => ({ ...r, total: Number(r.total) })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
