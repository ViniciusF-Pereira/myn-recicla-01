import test from 'node:test';
import assert from 'node:assert/strict';
import { Myn } from '../sdk/myn.mjs';

test('SDK envia bearer, mensagem e effort e retorna uso', async () => {
  let chamada;
  const fetchImpl = async (url, options) => {
    chamada = { url, options };
    return new Response(JSON.stringify({ resposta: 'ok', via: 'teste', uso: { usado: 1, limite: 100, restante: 99 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const myn = new Myn({ baseUrl: 'http://localhost:5188/', apiKey: 'myn_sk_teste', fetchImpl });
  const r = await myn.agent({ message: 'oi', session: 's1', effort: 'high' });
  assert.equal(r.resposta, 'ok');
  assert.equal(chamada.url, 'http://localhost:5188/v1/agent');
  assert.equal(chamada.options.headers.authorization, 'Bearer myn_sk_teste');
  assert.deepEqual(JSON.parse(chamada.options.body), { message: 'oi', session: 's1', route: 'auto', effort: 'high', planejar: false });
});

test('SDK preserva status e código de erro comercial', async () => {
  const fetchImpl = async () => new Response(JSON.stringify({ error: { type: 'quota_exceeded', message: 'cota diária excedida' } }), { status: 429 });
  const myn = new Myn({ apiKey: 'myn_sk_teste', fetchImpl });
  await assert.rejects(() => myn.usage(), (e) => e.status === 429 && e.code === 'quota_exceeded');
});
