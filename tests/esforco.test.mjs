import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ESFORCOS, normalizarEffort } from '../src/esforco.mjs';

test('effort normaliza valores e define orçamentos crescentes', () => {
  assert.equal(normalizarEffort(' HIGH '), 'high');
  assert.equal(normalizarEffort('invalido'), 'medium');
  assert.equal(normalizarEffort(''), 'medium');
  assert.deepEqual(Object.keys(ESFORCOS), ['low', 'medium', 'high']);
  assert.ok(ESFORCOS.low.rotas < ESFORCOS.medium.rotas);
  assert.ok(ESFORCOS.medium.rotas < ESFORCOS.high.rotas);
  assert.ok(ESFORCOS.low.rag < ESFORCOS.medium.rag);
  assert.ok(ESFORCOS.medium.rag < ESFORCOS.high.rag);
});

test('núcleo aplica planejamento e limite de RAG conforme o effort', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-esforco-'));
  process.env.MYN_DADOS = dir;
  const { executarAgente } = await import('../src/nucleo.mjs');
  let planos = 0;
  const limites = [], prompts = [];
  const deps = {
    planejar: async () => { planos++; return { passos: [{ n: 1, acao: 'rota', alvo: 'teste' }] }; },
    contextoRag: async (_pergunta, limite) => { limites.push(limite); return { texto: 'x'.repeat(limite + 100), fontes: ['docs/teste.md'] }; },
    responder: async (prompt) => { prompts.push(prompt); return { ok: true, texto: 'resposta de teste', via: 'teste' }; },
  };
  try {
    const low = await executarAgente({ mensagem: 'Pesquise sobre os workers do projeto.', sessao: 'effort-low', effort: 'low' }, deps);
    const medium = await executarAgente({ mensagem: 'Pesquise sobre os workers do projeto.', sessao: 'effort-medium', effort: 'medium' }, deps);
    const high = await executarAgente({ mensagem: 'Pesquise sobre os workers do projeto.', sessao: 'effort-high', effort: 'high' }, deps);
    const highSemPlano = await executarAgente({ mensagem: 'conte uma piada', sessao: 'effort-high-sem-plano', effort: 'high', planejar: false }, deps);
    assert.equal(low.effort, 'low');
    assert.equal(medium.effort, 'medium');
    assert.equal(high.effort, 'high');
    assert.equal(highSemPlano.effort, 'high');
    assert.deepEqual(limites, [3000, 5000, 8000]);
    assert.ok(prompts[2].includes('x'.repeat(8000)));
    assert.ok(!prompts[2].includes('x'.repeat(8001)));
    assert.equal(planos, 1);
    assert.ok(high.passos.some((p) => p.startsWith('planejamento:')));
    assert.ok(!highSemPlano.passos.some((p) => p.startsWith('planejamento:')));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
