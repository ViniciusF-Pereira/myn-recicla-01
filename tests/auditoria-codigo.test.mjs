import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { auditarCodigo } from '../src/auditoria-codigo.mjs';
import { caminhoPermitido } from '../src/worker-melhoria.mjs';

test('allowlist de merge bloqueia segredos e dados', () => {
  assert.equal(caminhoPermitido('docs/guia.md', false), true);
  assert.equal(caminhoPermitido('config/app.json', false), true);
  assert.equal(caminhoPermitido('src/stream.mjs', false), false);
  assert.equal(caminhoPermitido('src/stream.mjs', true), true);
  assert.equal(caminhoPermitido('.env', true), false);
  assert.equal(caminhoPermitido('dados/historico.jsonl', true), false);
  assert.equal(caminhoPermitido('src/../.env', true), false);
});

test('cada achado da auditoria é reproduzível e tem patch exato', async () => {
  const r = await auditarCodigo();
  assert.ok(r.resumo.total >= 0);
  for (const f of r.achados) {
    assert.equal(await f.teste(), true, f.id);
    if (!f.correcao) continue;
    const codigo = await readFile(f.arquivo, 'utf8');
    for (const c of f.correcao) {
      assert.ok(codigo.includes(c.antigo), f.id + ': trecho antigo ausente');
      assert.notEqual(c.antigo, c.novo, f.id + ': patch vazio');
    }
  }
});
