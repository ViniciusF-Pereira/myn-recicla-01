import test from 'node:test';
import assert from 'node:assert/strict';
import { criticar } from '../src/supervisor.mjs';

test('supervisor bloqueia Google e ação destrutiva', () => {
  assert.equal(criticar('use gemini').veredito, 'bloquear');
  assert.equal(criticar('apaga tudo com rm -rf').veredito, 'bloquear');
});

test('supervisor exige confirmação para mensageria', () => {
  const r = criticar('manda uma mensagem no telegram');
  assert.equal(r.risco, 2);
  assert.ok(r.falhas.some((f) => f.includes('confirmação')));
});

test('supervisor pede arquivo e teste para código', () => {
  const r = criticar('melhora o código');
  assert.equal(r.risco, 1);
  assert.ok(r.recomendacoes.some((x) => x.includes('/melhorar')));
});
