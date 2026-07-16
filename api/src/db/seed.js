// Popula o banco com as categorias + os 151 produtos extraídos do site atual
// e, opcionalmente, cria o admin inicial (se ADMIN_EMAIL/ADMIN_PASSWORD existirem).
// Idempotente: não duplica dados se rodar de novo.
// Uso: node src/db/seed.js   (ou: npm run seed)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./index');
const config = require('../config');

// Ordem e emoji das categorias, iguais à barra de filtros original do site.
const CATEGORIAS_ORDEM = [
  { nome: 'Snacks', emoji: '🍿' },
  { nome: 'Grãos', emoji: '🌾' },
  { nome: 'Farinhas Funcionais', emoji: '🌿' },
  { nome: 'Castanhas & Frutas Secas', emoji: '🥜' },
  { nome: 'Temperos', emoji: '🧂' },
  { nome: 'Ervas', emoji: '🌱' },
];

async function seedCategorias() {
  const prods = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'produtos-seed.json'), 'utf8'));

  // Garante que toda categoria presente no seed tenha uma entrada ordenada.
  const ordem = [...CATEGORIAS_ORDEM];
  for (const p of prods) {
    if (!ordem.find((c) => c.nome === p.c)) ordem.push({ nome: p.c, emoji: p.e || null });
  }

  const mapa = {}; // nome -> id
  let i = 0;
  for (const c of ordem) {
    i += 1;
    const existente = await db.query('SELECT id FROM categorias WHERE nome = ?', [c.nome]);
    if (existente.length) {
      mapa[c.nome] = existente[0].id;
    } else {
      const r = await db.run('INSERT INTO categorias (nome, emoji, ordem) VALUES (?, ?, ?)', [c.nome, c.emoji, i]);
      mapa[c.nome] = r.insertId;
    }
  }
  return { mapa, prods };
}

async function seedProdutos(mapa, prods) {
  const existentes = await db.query('SELECT COUNT(*) AS n FROM produtos', []);
  if (Number(existentes[0].n) > 0) {
    console.log(`[seed] produtos já existem (${existentes[0].n}), pulando inserção de produtos.`);
    return;
  }
  let ordem = 0;
  for (const p of prods) {
    ordem += 1;
    await db.run(
      'INSERT INTO produtos (nome, categoria_id, emoji, ativo, ordem) VALUES (?, ?, ?, ?, ?)',
      [p.n, mapa[p.c] || null, p.e || null, 1, ordem]
    );
  }
  console.log(`[seed] ${prods.length} produtos inseridos.`);
}

// Badges iniciais — os mesmos selos que já apareciam fixos no site.
const BADGES_INICIAIS = ['Sem Açúcar', 'Vegano', 'Orgânico', 'Sem Glúten', 'Sem Lactose', 'Natural'];

async function seedBadges() {
  let i = 0;
  for (const nome of BADGES_INICIAIS) {
    i += 1;
    const existente = await db.query('SELECT id FROM badges WHERE nome = ?', [nome]);
    if (!existente.length) {
      await db.run('INSERT INTO badges (nome, ordem) VALUES (?, ?)', [nome, i]);
    }
  }
  console.log(`[seed] ${BADGES_INICIAIS.length} badges garantidas.`);
}

async function seedAdmin() {
  if (!config.admin.email || !config.admin.senha) {
    console.log('[seed] ADMIN_EMAIL/ADMIN_PASSWORD não definidos — admin não criado (defina no .env para o painel).');
    return;
  }
  const existente = await db.query('SELECT id FROM admins WHERE email = ?', [config.admin.email]);
  if (existente.length) {
    console.log(`[seed] admin ${config.admin.email} já existe, pulando.`);
    return;
  }
  const hash = await bcrypt.hash(config.admin.senha, 10);
  await db.run('INSERT INTO admins (nome, email, senha_hash) VALUES (?, ?, ?)', [
    config.admin.nome,
    config.admin.email,
    hash,
  ]);
  console.log(`[seed] admin criado: ${config.admin.email}`);
}

async function main() {
  console.log(`[seed] dialeto: ${db.dialect}`);
  const { mapa, prods } = await seedCategorias();
  console.log(`[seed] ${Object.keys(mapa).length} categorias garantidas.`);
  await seedProdutos(mapa, prods);
  await seedBadges();
  await seedAdmin();
  await db.close();
  console.log('[seed] concluído.');
}

main().catch((err) => {
  console.error('[seed] ERRO:', err.message);
  process.exit(1);
});
