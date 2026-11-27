import test from 'node:test';
import assert from 'node:assert/strict';
import { respostaLocal } from '../src/conhecimento-local.mjs';

test('pesquisa sobre workers não é interceptada pelo conhecimento local', async () => {
  assert.equal(await respostaLocal('Pesquise sobre os workers do projeto.'), null);
});

test('pergunta direta sobre workers usa conhecimento local', async () => {
  const r = await respostaLocal('Como funcionam os workers?');
  assert.match(r, /análise/);
  assert.match(r, /melhoria/);
});
