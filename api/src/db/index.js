// Camada de acesso a banco com dois drivers intercambiáveis:
//   - sqlite: via node:sqlite (embutido no Node 22+). Zero instalação, ideal p/ dev local.
//   - mysql : via mysql2/promise. Produção na Hostinger (VPS ou compartilhada).
//
// Interface única (sempre assíncrona, placeholders "?"):
//   await db.query(sql, params) -> Array<row>            (SELECT)
//   await db.run(sql, params)   -> { insertId, affectedRows }  (INSERT/UPDATE/DELETE)
//   await db.exec(sqlMultiplo)  -> executa vários statements separados por ";"
//   db.dialect                  -> 'sqlite' | 'mysql'
//   await db.close()
const fs = require('fs');
const path = require('path');
const config = require('../config');

let impl = null;

function splitStatements(sqlText) {
  // Remove comentários "--" (linha inteira ou no fim da linha) e então divide
  // em statements por ";". Assim um ";" dentro de comentário não quebra nada.
  // (Nossos schemas não têm "--" dentro de strings/identificadores.)
  const cleaned = sqlText
    .split(/\r?\n/)
    .map((l) => {
      const i = l.indexOf('--');
      return i === -1 ? l : l.slice(0, i);
    })
    .join('\n');
  return cleaned
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length);
}

function createSqlite() {
  const { DatabaseSync } = require('node:sqlite');
  fs.mkdirSync(path.dirname(config.db.sqliteFile), { recursive: true });
  const sdb = new DatabaseSync(config.db.sqliteFile);
  sdb.exec('PRAGMA foreign_keys = ON;');

  return {
    dialect: 'sqlite',
    async query(sql, params = []) {
      return sdb.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const r = sdb.prepare(sql).run(...params);
      return { insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) };
    },
    async exec(sqlText) {
      for (const st of splitStatements(sqlText)) sdb.prepare(st).run();
    },
    async close() {
      sdb.close();
    },
  };
}

function createMysql() {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: config.db.mysql.host,
    port: config.db.mysql.port,
    user: config.db.mysql.user,
    password: config.db.mysql.password,
    database: config.db.mysql.database,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    dateStrings: true,
  });

  return {
    dialect: 'mysql',
    async query(sql, params = []) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async run(sql, params = []) {
      const [result] = await pool.query(sql, params);
      return { insertId: result.insertId, affectedRows: result.affectedRows };
    },
    async exec(sqlText) {
      for (const st of splitStatements(sqlText)) await pool.query(st);
    },
    async close() {
      await pool.end();
    },
  };
}

function getDb() {
  if (impl) return impl;
  impl = config.db.client === 'mysql' ? createMysql() : createSqlite();
  return impl;
}

module.exports = getDb();
