// Rotas públicas de produtos.
// GET /api/produtos?categoria=&busca=&pagina=&por_pagina=
//   -> { total, pagina, por_pagina, itens: [{id, nome, categoria, categoria_id, emoji, imagem_url}] }
// Só retorna produtos ativos. Preço NÃO é exposto publicamente.
const express = require('express');
const db = require('../db');
const { anexarBadges } = require('../lib/produtoBadges');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const categoria = (req.query.categoria || '').trim();
    const busca = (req.query.busca || '').trim().toLowerCase();
    const soDestaque = /^(1|true|yes|on)$/i.test(String(req.query.destaque || ''));
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    let porPagina = parseInt(req.query.por_pagina, 10) || 12;
    porPagina = Math.min(Math.max(porPagina, 1), 1000);

    const where = ['p.ativo = 1'];
    const params = [];

    if (categoria && categoria !== 'Todos') {
      where.push('c.nome = ?');
      params.push(categoria);
    }
    if (busca) {
      where.push('LOWER(p.nome) LIKE ?');
      params.push('%' + busca + '%');
    }
    if (soDestaque) where.push('p.destaque = 1');
    const whereSql = 'WHERE ' + where.join(' AND ');

    const totalRows = await db.query(
      `SELECT COUNT(*) AS n FROM produtos p LEFT JOIN categorias c ON c.id = p.categoria_id ${whereSql}`,
      params
    );
    const total = Number(totalRows[0].n);

    const offset = (pagina - 1) * porPagina;
    const itens = await db.query(
      `SELECT p.id, p.nome, p.emoji, p.imagem_url, p.descricao, p.disponivel, p.destaque, p.categoria_id, c.nome AS categoria
         FROM produtos p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         ${whereSql}
         ORDER BY p.ordem ASC, p.id ASC
         LIMIT ? OFFSET ?`,
      [...params, porPagina, offset]
    );
    await anexarBadges(itens);

    res.json({ total, pagina, por_pagina: porPagina, itens });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
