import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarOpenRouter } from '../src/modelos-livres.mjs';
import { escolherPara } from '../src/orquestrar-modelos.mjs';
import { buscar } from '../src/rag.mjs';
import { readFile } from 'node:fs/promises';

test('OpenRouter só considera gratuito quando ambas as direções são zero', () => {
  const r = normalizarOpenRouter({ data: [
    { id: 'x/free', name: 'Free', pricing: { prompt: '0', completion: '0' } },
    { id: 'x/suffix:free', name: 'Suffix', pricing: { prompt: '0.1', completion: '0.2' } },
    { id: 'x/paid', name: 'Paid', pricing: { prompt: '0', completion: '0.0001' } },
    { id: 'google/gemini:free', name: 'Google', pricing: { prompt: '0', completion: '0' } },
  ] });
  assert.deepEqual(r.map((m) => m.id), ['x/free', 'x/suffix:free']);
});

test('tarefa textual nunca escolhe gerador de imagem no modo rápido', async () => {
  const rotas = await escolherPara('escreva uma funcao javascript', 5, true);
  assert.ok(rotas.every((r) => !/image|imagem/i.test(r.id)));
});

test('RAG encontra documentos do próprio projeto sem caminho absoluto', async () => {
  const achados = await buscar('gzip desempenho worker', 3);
  assert.ok(achados.length > 0);
  assert.ok(achados.every((a) => !a.fonte.includes('Myncellium')));
});

test('caminho de execução não importa Google/Gemini', async () => {
  const servidor = await readFile('scripts/site-server.mjs', 'utf8');
  const stream = await readFile('src/stream.mjs', 'utf8');
  const rapido = await readFile('src/rapido.mjs', 'utf8');
  assert.ok(!servidor.includes("../src/google.mjs"));
  assert.ok(!/gemini/i.test(stream + rapido));
});
