import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';


test('resposta de código válida é aprovada', async () => {
  const { avaliarResposta } = await import('../src/avaliacao-qualidade.mjs');
  const r = avaliarResposta({ tarefa: 'some dois números', resposta: '```js\nfunction soma(a,b){return a+b}\n```', capacidades: ['codigo'], latenciaMs: 1000 });
  assert.equal(r.aprovado, true);
});

test('resposta que se identifica como outro produto é reprovada', async () => {
  const { avaliarResposta } = await import('../src/avaliacao-qualidade.mjs');
  const r = avaliarResposta({ tarefa: 'quem é você', resposta: 'Sou o ChatGPT e posso ajudar você com essa tarefa.', capacidades: ['chat'], latenciaMs: 1000 });
  assert.equal(r.aprovado, false);
  assert.ok(r.problemas.some((p) => p.includes('identidade')));
});

test('avaliação completa usa executor injetado', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-qualidade-'));
  process.env.MYN_DADOS = dir;
  const { rodarAvaliacao } = await import('../src/avaliacao-qualidade.mjs');
  try {
    const r = await rodarAvaliacao({ executar: async ({ mensagem }) => ({ resposta: mensagem.includes('função') ? 'function soma(a,b){return a+b}' : 'Myn Recicla/01 Playground WORKER_INFINITO docs/', via: 'teste', passos: [] }) });
    assert.equal(r.total, 4);
    assert.ok(r.aprovados >= 3);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
