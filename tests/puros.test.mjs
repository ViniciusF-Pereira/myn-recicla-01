import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarFilme } from '../src/filmes.mjs';
import { contarTokens } from '../src/rag.mjs';
import { extensaoArquivo } from '../src/midia.mjs';
import { NOME, VERSAO } from '../src/versao.mjs';

test('normalizarFilme remove tags', () => {
  assert.equal(normalizarFilme('<b>Matrix</b>'), 'Matrix');
});

test('contarTokens conta palavras', () => {
  assert.equal(contarTokens('a b c'), 3);
});

test('extensaoArquivo normaliza', () => {
  assert.equal(extensaoArquivo('foto.PNG'), 'png');
});

test('identidade do produto', () => {
  assert.equal(NOME, 'Myn Recicla/01');
  assert.ok(VERSAO);
});
