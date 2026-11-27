import test from 'node:test';
import assert from 'node:assert/strict';
import { permitir, executarComRetry, circuitoAberto, registrarResultado } from '../src/confiabilidade.mjs';

test('rate limit bloqueia após o limite', () => {
  assert.equal(permitir('teste-taxa', { max: 2, janelaMs: 60000 }), true);
  assert.equal(permitir('teste-taxa', { max: 2, janelaMs: 60000 }), true);
  assert.equal(permitir('teste-taxa', { max: 2, janelaMs: 60000 }), false);
});

test('retry repete 503 e termina quando a rota responde', async () => {
  let n = 0;
  const r = await executarComRetry(async () => {
    n++; if (n === 1) { const e = new Error('503'); e.status = 503; throw e; }
    return 'ok';
  }, { tentativas: 2, atrasoMs: 1, deveRepetir: (e) => e.status === 503 });
  assert.equal(r, 'ok'); assert.equal(n, 2);
});

test('circuit breaker abre após três falhas', () => {
  for (let i = 0; i < 3; i++) registrarResultado('teste-circuito', false);
  assert.equal(circuitoAberto('teste-circuito'), true);
});
