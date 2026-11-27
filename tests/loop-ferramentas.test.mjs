import test from 'node:test';
import assert from 'node:assert/strict';
import { executarLoopFerramentas } from '../src/loop-ferramentas.mjs';

test('loop executa ferramentas diferentes e usa as observações', async () => {
  const chamadas = [];
  const r = await executarLoopFerramentas({
    objetivo: 'verifique a arquitetura e o desempenho do projeto',
    maxPassos: 2,
    executarFerramenta: async (nome) => { chamadas.push(nome); return nome === 'myn_arquitetura' ? '64 módulos, 0 ciclos' : '40 KB, p50 4ms'; },
  });
  assert.deepEqual(chamadas, ['myn_arquitetura', 'myn_desempenho']);
  assert.equal(r.sucesso, true);
  assert.match(r.resposta, /64 módulos/);
  assert.match(r.resposta, /40 KB/);
});

test('loop registra falha de ferramenta sem interromper o ciclo', async () => {
  const r = await executarLoopFerramentas({
    objetivo: 'liste as rotas e modelos',
    maxPassos: 2,
    executarFerramenta: async (nome) => { if (nome === 'myn_modelos') throw new Error('cota'); return '154 rotas'; },
  });
  assert.equal(r.passos.length, 2);
  assert.ok(r.passos.some((p) => !p.ok));
});
