import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('fila de pedidos aceita arquivo permitido e rejeita traversal', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-pedidos-'));
  process.env.MYN_DADOS = dir;
  const { criarPedido, listarPendentes, concluirPedido } = await import('../src/pedidos.mjs');
  const p = await criarPedido({ objetivo: 'corrigir timeout', arquivo: 'src/stream.mjs' });
  assert.equal((await listarPendentes()).length, 1);
  await assert.rejects(() => criarPedido({ objetivo: 'ataque', arquivo: 'src/../.env' }));
  await concluirPedido(p.id, 'aplicado');
  assert.equal((await listarPendentes()).length, 0);
  await rm(dir, { recursive: true, force: true });
});
