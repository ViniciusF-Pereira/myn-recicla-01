import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

async function comNucleo(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-nucleo-'));
  process.env.MYN_DADOS = dir;
  const nucleo = await import('../src/nucleo.mjs');
  const memoria = await import('../src/memoria.mjs');
  try { await fn(nucleo, memoria); } finally { await rm(dir, { recursive: true, force: true }); }
}

test('núcleo usa conhecimento local e registra memória', async () => {
  await comNucleo(async (nucleo, memoria) => {
    const r = await nucleo.executarAgente({ mensagem: 'como você funciona?', sessao: 's1' });
    assert.equal(r.via, 'conhecimento-local');
    assert.match(r.resposta, /Myn Recicla\/01/);
    assert.ok((await memoria.contextoMemoria('s1')).length >= 2);
  });
});

test('núcleo injeta memória relacionada no prompt do modelo', async () => {
  await comNucleo(async (nucleo) => {
    const prompts = [];
    const deps = { responder: async (p) => { prompts.push(p); return { ok: true, texto: 'resposta ' + prompts.length, via: 'teste' }; } };
    await nucleo.executarAgente({ mensagem: 'minha linguagem favorita é javascript', sessao: 's2' }, deps);
    await nucleo.executarAgente({ mensagem: 'conte uma piada', sessao: 's2' }, deps);
    assert.match(prompts[1], /javascript/);
    assert.match(prompts[1], /MEMÓRIA RELACIONADA/);
  });
});

test('pesquisa cai para RAG local quando a rota externa falha', async () => {
  await comNucleo(async (nucleo) => {
    const r = await nucleo.executarAgente({ mensagem: 'Pesquise sobre os workers do projeto.', sessao: 'rag' }, {
      responder: async () => { throw new Error('cota'); },
      contextoRag: async () => ({ texto: 'docs/WORKER_INFINITO.md descreve os workers.', fontes: ['docs/WORKER_INFINITO.md'] }),
    });
    assert.equal(r.via, 'rag-local');
    assert.match(r.resposta, /WORKER_INFINITO/);
  });
});

test('streaming do núcleo emite início, tokens e fim', async () => {
  await comNucleo(async (nucleo, memoria) => {
    const eventos = [];
    for await (const e of nucleo.executarAgenteStream({ mensagem: 'conte uma piada', sessao: 'stream' }, {
      streamResponder: async function* () { yield { token: 'piada ' }; yield { token: 'curta', via: 'teste' }; yield { done: true, texto: 'piada curta', via: 'teste' }; },
    })) eventos.push(e);
    assert.ok(eventos.some((e) => e.inicio));
    assert.ok(eventos.some((e) => e.token));
    assert.equal(eventos.at(-1).done, true);
    assert.ok((await memoria.contextoMemoria('stream')).some((r) => r.papel === 'assistente'));
  });
});

test('preferências persistem por sessão', async () => {
  await comNucleo(async (_nucleo, memoria) => {
    await memoria.salvarPreferencia('voz', 'pt-BR', 's3');
    assert.deepEqual(await memoria.preferencias('s3'), { voz: 'pt-BR' });
  });
});

test('resposta direta do RAG preserva rota e fontes', async () => {
  await comNucleo(async (nucleo) => {
    const r = await nucleo.executarAgente(
      { mensagem: 'Pesquise fontes sobre a extensão do Myn.', sessao: 'rag-direto', effort: 'low' },
      { contextoRag: async () => ({ texto: 'A extensão usa permissões por site.', fontes: ['docs/EXTENSAO.md'] }) },
    );
    assert.equal(r.via, 'rag-local');
    assert.match(r.resposta, /Encontrei contexto local/);
    assert.ok(r.fontes.length > 0);
  });
});
