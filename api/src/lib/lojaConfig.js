// Config efetiva da loja: valores do banco (config_loja) sobrepondo os defaults
// do .env (config.store). É a fonte única usada pelo /api/config, pela injeção
// no index.html e pelo painel admin. Cacheia em memória e invalida ao salvar.
const db = require('../db');
const config = require('../config');

// Mapeamento chave-no-banco -> como aparece no objeto público.
// (cart_* são numéricos; os demais são texto.)
const CHAVES = [
  'store_name', 'store_whatsapp', 'store_address', 'store_city',
  'store_cep', 'store_hours', 'instagram_url',
  'cart_min_grams', 'cart_step_grams', 'cart_max_grams',
];

let cache = null;

function toInt(v, def) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? def : n;
}

// Lê o config_loja e monta o objeto efetivo (banco tem prioridade sobre o .env).
async function carregar() {
  if (cache) return cache;
  const base = config.store;
  const map = {};
  try {
    const rows = await db.query('SELECT chave, valor FROM config_loja', []);
    rows.forEach((r) => { map[r.chave] = r.valor; });
  } catch (e) {
    // Tabela pode não existir ainda (antes do migrate): usa só os defaults.
  }
  const val = (k, d) => (map[k] !== undefined && map[k] !== null ? map[k] : d);
  cache = {
    name: val('store_name', base.name),
    whatsapp: String(val('store_whatsapp', base.whatsapp)).replace(/\D/g, ''),
    address: val('store_address', base.address),
    city: val('store_city', base.city),
    cep: val('store_cep', base.cep),
    hours: val('store_hours', base.hours),
    instagram: val('instagram_url', base.instagram),
    cart: {
      minGrams: toInt(val('cart_min_grams', base.cart.minGrams), base.cart.minGrams),
      stepGrams: toInt(val('cart_step_grams', base.cart.stepGrams), base.cart.stepGrams),
      maxGrams: toInt(val('cart_max_grams', base.cart.maxGrams), base.cart.maxGrams),
    },
  };
  return cache;
}

function invalidar() { cache = null; }

// Upsert dialect-agnostic (existe? UPDATE : INSERT).
async function upsert(chave, valor) {
  const existe = await db.query('SELECT 1 FROM config_loja WHERE chave = ?', [chave]);
  if (existe.length) {
    await db.run('UPDATE config_loja SET valor = ? WHERE chave = ?', [valor, chave]);
  } else {
    await db.run('INSERT INTO config_loja (chave, valor) VALUES (?, ?)', [chave, valor]);
  }
}

// Salva um objeto { chave: valor } (só chaves conhecidas) e invalida o cache.
async function salvar(campos) {
  for (const chave of CHAVES) {
    if (Object.prototype.hasOwnProperty.call(campos, chave)) {
      await upsert(chave, String(campos[chave]));
    }
  }
  invalidar();
  return carregar();
}

module.exports = { carregar, invalidar, salvar, CHAVES };
