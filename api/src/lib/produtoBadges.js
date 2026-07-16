// Helpers de badges de produto, compartilhados entre as rotas pública e admin.
const db = require('../db');

// Anexa a lista de badges (ordenadas) a cada produto, em UMA query (evita N+1).
// Adiciona a propriedade `badges: [{ id, nome }]` a cada linha. Mutação in-place;
// também retorna o array por conveniência.
async function anexarBadges(produtos) {
  if (!Array.isArray(produtos) || produtos.length === 0) return produtos;
  const ids = produtos.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.query(
    `SELECT pb.produto_id, b.id, b.nome
       FROM produto_badges pb
       JOIN badges b ON b.id = pb.badge_id
      WHERE pb.produto_id IN (${placeholders})
      ORDER BY b.ordem ASC, b.nome ASC`,
    ids
  );
  const porProduto = {};
  for (const r of rows) {
    (porProduto[r.produto_id] = porProduto[r.produto_id] || []).push({ id: r.id, nome: r.nome });
  }
  for (const p of produtos) p.badges = porProduto[p.id] || [];
  return produtos;
}

// Substitui o conjunto de badges de um produto pelos ids informados.
// Ignora ids inválidos (que não existem na tabela badges).
async function definirBadges(produtoId, badgeIds) {
  await db.run('DELETE FROM produto_badges WHERE produto_id = ?', [produtoId]);
  const ids = Array.from(
    new Set((Array.isArray(badgeIds) ? badgeIds : []).map((v) => parseInt(v, 10)).filter((n) => Number.isInteger(n) && n > 0))
  );
  if (!ids.length) return;
  // Mantém só ids que existem de fato.
  const placeholders = ids.map(() => '?').join(',');
  const validos = await db.query(`SELECT id FROM badges WHERE id IN (${placeholders})`, ids);
  for (const b of validos) {
    await db.run('INSERT INTO produto_badges (produto_id, badge_id) VALUES (?, ?)', [produtoId, b.id]);
  }
}

module.exports = { anexarBadges, definirBadges };
