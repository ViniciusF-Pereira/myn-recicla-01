import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('lock impede dois workers no mesmo diretório e libera ao terminar', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-lock-'));
  process.env.MYN_DADOS = dir;
  const { adquirirLock } = await import('../src/lock.mjs');
  const primeiro = await adquirirLock('teste');
  assert.equal(primeiro.ok, true);
  const segundo = await adquirirLock('teste');
  assert.equal(segundo.ok, false);
  await primeiro.liberar();
  const terceiro = await adquirirLock('teste');
  assert.equal(terceiro.ok, true);
  await terceiro.liberar();
  await rm(dir, { recursive: true, force: true });
});
