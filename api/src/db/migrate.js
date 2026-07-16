// Cria as tabelas executando o schema do dialeto ativo.
// Uso: node src/db/migrate.js   (ou: npm run migrate)
const fs = require('fs');
const path = require('path');
const db = require('./index');

// Lista as colunas de uma tabela (por dialeto)
async function colunas(tabela) {
  if (db.dialect === 'mysql') {
    const rows = await db.query(
      'SELECT COLUMN_NAME AS nome FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
      [tabela]
    );
    return rows.map((r) => r.nome);
  }
  const rows = await db.query(`PRAGMA table_info(${tabela})`, []);
  return rows.map((r) => r.name);
}

// Adiciona uma coluna se ela ainda não existir (migração aditiva idempotente)
async function garantirColuna(tabela, coluna, defSqlite, defMysql) {
  const existentes = await colunas(tabela);
  if (existentes.includes(coluna)) return;
  const def = db.dialect === 'mysql' ? defMysql : defSqlite;
  await db.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${def}`, []);
  console.log(`[migrate] coluna adicionada: ${tabela}.${coluna}`);
}

async function main() {
  const file = db.dialect === 'mysql' ? 'schema.mysql.sql' : 'schema.sqlite.sql';
  const sql = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
  console.log(`[migrate] dialeto: ${db.dialect} | schema: ${file}`);
  await db.exec(sql);

  // Migrações aditivas para bancos criados antes de novas colunas existirem
  await garantirColuna('produtos', 'disponivel', 'INTEGER NOT NULL DEFAULT 1', 'TINYINT(1) NOT NULL DEFAULT 1');
  await garantirColuna('produtos', 'descricao', 'TEXT', 'VARCHAR(500)');
  await garantirColuna('produtos', 'destaque', 'INTEGER NOT NULL DEFAULT 0', 'TINYINT(1) NOT NULL DEFAULT 0');

  console.log('[migrate] tabelas criadas/verificadas com sucesso.');
  await db.close();
}

main().catch((err) => {
  console.error('[migrate] ERRO:', err.message);
  process.exit(1);
});
