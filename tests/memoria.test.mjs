import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('memória gera resumo e busca vetorial relacionada', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-memoria-'));
  process.env.MYN_DADOS = dir;
  const m = await import('../src/memoria.mjs');
  try {
    for (let i = 0; i < 10; i++) await m.registrarMemoria({ sessao: 's', papel: i % 2 ? 'assistente' : 'usuario', texto: 'O projeto usa Canvas e MediaRecorder para mídia no navegador.' });
    const resumo = await m.resumirMemoria('s', 2);
    assert.match(resumo, /Canvas/);
    const busca = await m.buscarMemoria('Canvas MediaRecorder navegador', { sessao: 's' });
    assert.ok(busca.length > 0);
    assert.ok(busca[0].vetorial > 0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
