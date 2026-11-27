import test from 'node:test';
import assert from 'node:assert/strict';
import { criarMemoria } from '../web/core/memoria-cliente.mjs';
import { scoreHibrido, resumirExtrativo, trechoRelevante } from '../web/rag/ranking.mjs';

function repoFake() {
  const tabelas = { eventos: new Map(), sessoes: new Map() };
  return {
    async inserir(t, v) { tabelas[t].set(v.id ?? (tabelas[t].size + 1), { ...v }); },
    async listar(t) { return [...tabelas[t].values()]; },
    async obter(t, id) { return tabelas[t].get(id); },
    async remover(t, id) { tabelas[t].delete(id); },
  };
}

test('ranking híbrido combina lexical e vetor e produz trecho relevante', () => {
  const r = scoreHibrido('worker melhoria', 'O worker de melhoria aplica patches testados.');
  assert.ok(r.lexical > 0);
  assert.ok(r.vetorial > 0);
  assert.ok(r.score > 0);
  assert.match(trechoRelevante('antes '.repeat(100) + 'worker melhoria aplica patches', 'worker'), /worker/);
  assert.match(resumirExtrativo('O worker analisa código. O worker aplica patches testados. Uma frase curta.', 1), /worker/);
});

test('memória isola sessão, projeto e global', async () => {
  const m = criarMemoria(repoFake());
  await m.registrar({ sessao: 's1', texto: 'sessão um' });
  await m.registrar({ sessao: 's2', texto: 'sessão dois' });
  await m.registrar({ projeto: 'p1', escopo: 'projeto', texto: 'projeto um' });
  await m.registrar({ escopo: 'global', texto: 'global' });
  assert.equal((await m.contexto({ sessao: 's1' })).length, 1);
  assert.equal((await m.contexto({ projeto: 'p1', escopo: 'projeto' })).length, 1);
  assert.equal((await m.contexto({ escopo: 'global' })).length, 4);
});

test('memória busca híbrida, resume e persiste resumo sem duplicar', async () => {
  const m = criarMemoria(repoFake());
  await m.registrar({ sessao: 's1', texto: 'O Myn usa Canvas e MediaRecorder para mídia no navegador.' });
  await m.registrar({ sessao: 's1', texto: 'A extensão abre a VM Web no painel lateral.' });
  const busca = await m.buscar('Canvas MediaRecorder navegador', { sessao: 's1' });
  assert.ok(busca.length > 0);
  assert.ok(busca[0].vetorial > 0);
  const resumo = await m.resumir({ sessao: 's1', limite: 2, persistir: true });
  assert.match(resumo, /Canvas|extensão/);
  const stats = await m.estatisticas({ sessao: 's1' });
  assert.equal(stats.resumos, 1);
  await m.resumir({ sessao: 's1', persistir: true });
  assert.equal((await m.estatisticas({ sessao: 's1' })).resumos, 1);
});

test('memória exporta, importa e limpa preferências', async () => {
  const m = criarMemoria(repoFake());
  await m.registrar({ sessao: 's1', texto: 'minha linguagem favorita é javascript' });
  await m.salvarPreferencia('voz', 'pt-BR', { sessao: 's1' });
  const json = await m.exportar({ sessao: 's1' });
  assert.equal(json._myn, 'myn-memoria');
  assert.equal(json.eventos.length, 1);
  assert.equal(json.preferencias.voz, 'pt-BR');
  const m2 = criarMemoria(repoFake());
  assert.equal(await m2.importar(json, { sessao: 's1' }), 1);
  assert.equal(await m2.preferencia('voz', { sessao: 's1' }), 'pt-BR');
  assert.equal(await m2.limpar({ sessao: 's1' }), 1);
  assert.equal((await m2.contexto({ sessao: 's1' })).length, 0);
  assert.equal(await m2.preferencia('voz', { sessao: 's1' }), null);
});
