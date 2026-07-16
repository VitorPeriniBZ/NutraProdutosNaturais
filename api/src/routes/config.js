// Rota pública de configuração da loja.
// GET /api/config -> dados públicos da loja (nome, contato, endereço, horário,
// Instagram e regras do carrinho). Não exige autenticação.
const express = require('express');
const config = require('../config');

const router = express.Router();

// Monta o objeto público (fonte única para o frontend e para a injeção no HTML).
function configPublica() {
  const s = config.store;
  return {
    name: s.name,
    whatsapp: s.whatsapp,
    address: s.address,
    city: s.city,
    cep: s.cep,
    hours: s.hours,
    instagram: s.instagram,
    cart: {
      minGrams: s.cart.minGrams,
      stepGrams: s.cart.stepGrams,
      maxGrams: s.cart.maxGrams,
    },
  };
}

router.get('/', (req, res) => {
  res.json(configPublica());
});

module.exports = router;
module.exports.configPublica = configPublica;
