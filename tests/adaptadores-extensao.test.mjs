import test from 'node:test';
import assert from 'node:assert/strict';
import { ROTAS, VERSAO_ADAPTADORES } from '../site/extensao/rotas.js';
import { CATALOGO_CHATS } from '../site/extensao/catalogo-chats.js';
import { criarAdaptador } from '../site/extensao/descoberta.mjs';
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

test('catálogo de chats é amplo, único e mantém proibição Google/Gemini', () => {
  const ids = new Set(CATALOGO_CHATS.map((c) => c.id));
  assert.ok(ids.size >= 20);
  assert.equal(ids.size, CATALOGO_CHATS.length);
  for (const chat of CATALOGO_CHATS) {
    assert.match(chat.url, /^https:\/\//);
    assert.equal(new URL(chat.url).origin, chat.origem);
    assert.ok(!/google|gemini/i.test(chat.id + chat.nome + chat.url));
  }
  assert.ok(CATALOGO_CHATS.some((c) => c.id === 'perplexity-web'));
  assert.ok(CATALOGO_CHATS.some((c) => c.id === 'qwen-web'));
});

test('descoberta exige confiança, respeita bloqueio e valida seletores escolhidos', () => {
  const relatorio = {
    titulo: 'Chat de teste', origem: 'https://exemplo.com', url: 'https://exemplo.com/', bloqueio: '',
    sugestao: { compositor: '#entrada', envio: '#enviar', resposta: '#resposta', confianca: .91 },
    candidatos: {
      compositores: [{ seletor: '#entrada', pontos: .95 }, { seletor: 'textarea', pontos: .8 }, { seletor: 'input', pontos: .05 }],
      envios: [{ seletor: '#enviar', pontos: .92 }],
      respostas: [{ seletor: '#resposta', pontos: .72 }],
    },
  };
  const adaptador = criarAdaptador(relatorio, '', { compositor: 'textarea' });
  assert.equal(adaptador.campos[0], 'textarea');
  assert.equal(adaptador.descoberta, true);
  assert.throws(() => criarAdaptador({ ...relatorio, bloqueio: 'captcha' }), /bloqueada/);
  assert.throws(() => criarAdaptador(relatorio, '', { compositor: 'input' }), /confiança insuficiente/);
  assert.throws(() => criarAdaptador(relatorio, '', { resposta: '#fora' }), /não pertence/);
});

test('rotas descobertas podem ser explícitas e entrar no fallback automático', () => {
  const catalogoExtensao = [{ id: 'descoberto-teste', descoberta: true }];
  assert.deepEqual(selecionarRotas({ rota: 'descoberto-teste', extensaoDisponivel: true, catalogoExtensao }), ['descoberto-teste']);
  assert.deepEqual(selecionarRotas({ rota: 'descoberto-teste', extensaoDisponivel: false, catalogoExtensao }), []);
  const rotas = selecionarRotas({ effort: 'medium', extensaoDisponivel: true, catalogoExtensao, saude: { 'descoberto-teste': { estado: 'closed', score: 1 } } });
  assert.equal(rotas[0], 'pollinations-text-api');
  assert.ok(rotas.includes('descoberto-teste'));
});
