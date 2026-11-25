import test from 'node:test';
import assert from 'node:assert/strict';
import { auditarArquitetura } from '../src/arquitetura.mjs';

test('núcleo não depende da apresentação', async () => {
  const r = await auditarArquitetura();
  assert.equal(r.resumo.violacoes, 0, JSON.stringify(r.violacoes));
});

test('não existem ciclos entre módulos', async () => {
  const r = await auditarArquitetura();
  assert.equal(r.resumo.ciclos, 0, JSON.stringify(r.violacoes));
});

test('imports relativos resolvem para arquivos existentes', async () => {
  const r = await auditarArquitetura();
  assert.equal(r.resumo.importsNaoResolvidos, 0, JSON.stringify(r.importsNaoResolvidos));
});
