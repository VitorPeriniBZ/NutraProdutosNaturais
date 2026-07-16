// Rota pública de badges.
// GET /api/badges -> [{ id, nome, ordem, total }]  (total = produtos ativos com a badge)
const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const rows = await db.query(
      `SELECT b.id, b.nome, b.ordem,
              COUNT(CASE WHEN p.ativo = 1 THEN 1 END) AS total
         FROM badges b
         LEFT JOIN produto_badges pb ON pb.badge_id = b.id
         LEFT JOIN produtos p ON p.id = pb.produto_id
         GROUP BY b.id, b.nome, b.ordem
         ORDER BY b.ordem ASC, b.nome ASC`,
      []
    );
    res.json(rows.map((r) => ({ ...r, total: Number(r.total) })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
