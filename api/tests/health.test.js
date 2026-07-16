// Teste de fumaça do endpoint de saúde, usando o test runner nativo do Node
// (node:test) + supertest sobre o app Express (sem abrir porta).
const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../src/server');

test('GET /api/health responde 200 com { ok: true }', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.ok, true);
});
