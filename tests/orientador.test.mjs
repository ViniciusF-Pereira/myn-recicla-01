import test from 'node:test';
import assert from 'node:assert/strict';
import { orientarPedido } from '../web/tools/orientador.mjs';

test('orientador escolhe tool local por intenção', () => {
  assert.equal(orientarPedido('gere uma planilha de alertas').intencao, 'planilha');
  assert.equal(orientarPedido('crie uma imagem editorial').intencao, 'imagem');
  assert.equal(orientarPedido('faça um vídeo de 6 segundos').intencao, 'video');
  const audio = orientarPedido('narrar este texto');
  assert.equal(audio.intencao, 'audio');
  assert.deepEqual(audio.ferramentas, ['estudio_audio']);
});

test('orientador prioriza pesquisa e memória sem inventar ferramenta', () => {
  const pesquisa = orientarPedido('pesquise fontes e compare as rotas');
  assert.equal(pesquisa.intencao, 'pesquisa');
  assert.equal(orientarPedido('pesquise sobre a extensão').intencao, 'pesquisa');
  assert.ok(pesquisa.ferramentas.includes('rag_local'));
  assert.equal(orientarPedido('o que está na memória?').intencao, 'memoria');
  assert.equal(orientarPedido('conte uma piada').intencao, 'chat');
});
