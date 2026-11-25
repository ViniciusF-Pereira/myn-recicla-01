import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOpenRouter } from '../src/modelos-livres.mjs';
import { escolherPara, orquestrar, carregarMapaModelos } from '../src/orquestrar-modelos.mjs';
import { buscar } from '../src/rag.mjs';
import { gerarProposta } from '../src/engenheiro.mjs';
import { readFile } from 'node:fs/promises';

test('OpenRouter só considera gratuito quando ambas as direções são zero', () => {
  const r = normalizarOpenRouter({ data: [
    { id: 'x/free', name: 'Free', pricing: { prompt: '0', completion: '0' } },
    { id: 'x/numeric-free', name: 'Numeric', pricing: { prompt: 0, completion: 0 } },
    { id: 'x/suffix:free', name: 'Suffix', pricing: { prompt: '0.1', completion: '0.2' } },
    { id: 'x/paid', name: 'Paid', pricing: { prompt: '0', completion: '0.0001' } },
    { id: 'google/gemini:free', name: 'Google', pricing: { prompt: '0', completion: '0' } },
  ] });
  assert.deepEqual(r.map((m) => m.id), ['x/free', 'x/numeric-free', 'x/suffix:free']);
});

test('tarefa textual nunca escolhe gerador de imagem no modo rápido', async () => {
  const rotas = await escolherPara('escreva uma funcao javascript', 5, true);
  assert.ok(rotas.length > 0);
  assert.ok(rotas.some((r) => r.id === 'pollinations-text-api'));
  assert.ok(rotas.every((r) => !/image|imagem/i.test(r.id)));
});

test('todo modelo mapeado tem plugin real e nenhum é Google', async () => {
  const mapa = await carregarMapaModelos();
  const plugins = JSON.parse(await readFile('config/plugins.json', 'utf8')).plugins;
  const ids = new Set(plugins.map((p) => p.id));
  assert.ok(mapa.every((r) => ids.has(r.id)), JSON.stringify(mapa.filter((r) => !ids.has(r.id)).map((r) => r.id)));
  assert.ok(mapa.every((r) => !/google|gemini/i.test(r.id + r.nome + r.modelo)));
  assert.ok(mapa.every((r) => !/-local$/.test(r.id)));
});

test('orquestrador não escolhe gerador local nem em modo normal', async () => {
  const rotas = await escolherPara('gere uma imagem de um gato', 10, false);
  assert.ok(rotas.every((r) => !/-local$/.test(r.id)));
});

test('se todas as rotas falham, o orquestrador usa fallback determinístico', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response('erro', { status: 500 });
  try {
    const r = await orquestrar({
      tarefa: 'oi',
      plugins: [{ id: 'pollinations-text-api', nome: 'Pollinations', acao: 'api', api: { url: 'http://fake/{encode}', tipo: 'texto' } }],
      rapido: true,
    });
    assert.equal(r.vencedor.rota, 'deterministico');
    assert.equal(r.via, 'deterministico');
  } finally {
    globalThis.fetch = original;
  }
});

test('RAG encontra documentos do próprio projeto sem caminho absoluto', async () => {
  const achados = await buscar('worker melhoria auditoria', 3);
  assert.ok(achados.length > 0);
  assert.ok(achados.every((a) => !a.fonte.includes('Myncellium')));
});

test('engenheiro expõe exatamente o que enviaria ao provedor', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    model: 'modelo-teste',
    choices: [{ message: { content: JSON.stringify({ titulo: 'teste', motivo: 'motivo', substituicoes: [{ antigo: 'a', novo: 'b' }] }) } }],
  }), { status: 200, headers: { 'content-type': 'application/json' } });
  try {
    const p = await gerarProposta();
    assert.equal(p.envio.endpoint, 'https://text.pollinations.ai/openai');
    assert.ok(p.envio.caracteres > 0);
    assert.ok(Array.isArray(p.envio.testes));
    assert.ok(p.envio.arquivo);
  } finally {
    globalThis.fetch = original;
  }
});

test('caminho de execução não importa Google/Gemini', async () => {
  const servidor = await readFile('scripts/site-server.mjs', 'utf8');
  const stream = await readFile('src/stream.mjs', 'utf8');
  const rapido = await readFile('src/rapido.mjs', 'utf8');
  assert.ok(!servidor.includes("../src/google.mjs"));
  assert.ok(!/gemini/i.test(stream + rapido));
});
