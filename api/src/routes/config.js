// Rota pública de configuração da loja.
// GET /api/config -> config efetiva (banco sobrepondo o .env). Sem autenticação.
const express = require('express');
const lojaConfig = require('../lib/lojaConfig');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    res.json(await lojaConfig.carregar());
  } catch (err) {
    next(err);
  }
});

module.exports = router;
