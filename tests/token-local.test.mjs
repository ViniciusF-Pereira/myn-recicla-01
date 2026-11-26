import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('token local é emitido, validado e renovado', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-token-'));
  process.env.MYN_DADOS = dir;
  const { emitirToken, validarToken } = await import('../src/token-local.mjs');
  const primeiro = await emitirToken({ ttlMs: 60000 });
  assert.ok(primeiro.token.length >= 32);
  assert.equal(await validarToken(primeiro.token), true);
  assert.equal(await validarToken('token-errado'), false);
  const segundo = await emitirToken({ renovar: true, ttlMs: 60000 });
  assert.notEqual(segundo.token, primeiro.token);
  assert.equal(await validarToken(primeiro.token), false);
  assert.equal(await validarToken(segundo.token), true);
  await rm(dir, { recursive: true, force: true });
});
