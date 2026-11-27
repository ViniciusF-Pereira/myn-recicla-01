import test from 'node:test';
import assert from 'node:assert/strict';
import { ROTAS, VERSAO_ADAPTADORES } from '../site/extensao/rotas.js';
import { registrarResultado, pontuar, ordenar } from '../site/extensao/saude.mjs';
import { selecionarRotas } from '../web/core/rotas-cliente.mjs';

test('adaptadores são versionados e têm alternativas de composer/envio/resposta', () => {
  assert.ok(VERSAO_ADAPTADORES >= 2);
  const ids = new Set();
  for (const rota of ROTAS) {
    assert.ok(!ids.has(rota.id)); ids.add(rota.id);
    assert.ok(rota.versao >= 1);
    assert.ok(rota.campos.length >= 1);
    assert.ok(rota.envio.length >= 1);
    assert.ok(rota.respostas.length >= 1);
    assert.ok(!/:has-text/.test(JSON.stringify(rota)));
    assert.ok(!/google|gemini/i.test(rota.id + rota.nome + rota.url));
  }
});

test('saúde abre circuito após três falhas e fecha após sucesso', () => {
  let s = {};
  for (let i = 0; i < 3; i++) s = registrarResultado(s, { ok: false, ms: 1000, erro: 'layout' }, 1000);
  assert.equal(s.estado, 'open');
  assert.equal(pontuar('rota', s, 2000).estado, 'open');
  s = registrarResultado(s, { ok: true, ms: 500 }, 3000);
  assert.equal(s.estado, 'closed');
  assert.equal(s.falhas, 0);
});

test('seleção de rotas usa saúde e evita circuito aberto', () => {
  const rotas = selecionarRotas({ effort: 'high', extensaoDisponivel: true, saude: {
    'chatgpt-web': { estado: 'open', score: 0 },
    'claude-web': { estado: 'closed', score: .9 },
    'huggingchat': { estado: 'closed', score: .8 },
  } });
  assert.equal(rotas[0], 'pollinations-text-api');
  assert.ok(rotas.includes('claude-web'));
  assert.ok(!rotas.includes('chatgpt-web'));
  const ordenadas = ordenar(ROTAS.filter((r) => !r.oculta), { 'claude-web': { sucessos: 10, falhas: 0, ultimaLatenciaMs: 1000 } });
  assert.equal(ordenadas[0].id, 'claude-web');
});
