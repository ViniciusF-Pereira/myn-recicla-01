import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretarPedidoLoja, criarAdaptadorLoja, parseValorMonetario, produtoCorresponde } from '../site/extensao/lojas.mjs';
import { LOJAS_CONHECIDAS } from '../site/extensao/catalogo-lojas.js';
import { confirmacaoChatLoja, extrairTextoChat, decidir } from '../site/assistente.mjs';

test('pedido de loja extrai produto, orçamento e ocasião', () => {
  const p = interpretarPedidoLoja('Quero um fone até 250 reais de presente');
  assert.equal(p.termo, 'fone');
  assert.equal(p.budget, 250);
  assert.equal(p.ocasiao, 'presente');
  assert.equal(p.categoria, 'fone');
});

test('adaptador de loja exige busca, produtos e confiança', () => {
  const relatorio = {
    origem: 'https://loja.test', url: 'https://loja.test/?token=secreto#produto', titulo: 'Loja Teste', bloqueio: '', confianca: .82,
    busca: { campo: '#q', botao: '#buscar', formulario: '#form', confianca: .9 },
    produtos: { cards: '.card', link: 'a', titulo: 'h2', preco: '.price' },
    entradas: [],
    chat: { entradas: [{ seletor: '#abrirChat', texto: 'Atendimento online' }] },
  };
  const a = criarAdaptadorLoja(relatorio);
  assert.equal(a.tipo, 'loja');
  assert.equal(a.url, 'https://loja.test/');
  assert.equal(a.busca.campo, '#q');
  assert.equal(a.chat.entradas[0].seletor, '#abrirChat');
  assert.throws(() => criarAdaptadorLoja({ ...relatorio, confianca: .2 }), /confiança/);
  assert.throws(() => criarAdaptadorLoja({ ...relatorio, busca: null }), /busca/);
  assert.throws(() => criarAdaptadorLoja({ ...relatorio, busca: { ...relatorio.busca, confianca: .2 } }), /busca semântica/);
  assert.throws(() => criarAdaptadorLoja({ ...relatorio, bloqueio: 'captcha' }), /bloqueada/);
});

test('catálogo de lojas é específico e não inclui Google', () => {
  const ids = new Set(LOJAS_CONHECIDAS.map((l) => l.id));
  assert.equal(ids.size, LOJAS_CONHECIDAS.length);
  assert.ok(ids.has('americanas'));
  assert.ok(ids.has('magalu'));
  assert.ok(ids.has('casasbahia'));
  assert.ok(!/google|gemini/i.test(JSON.stringify(LOJAS_CONHECIDAS)));
});

test('valores monetários aceitam formato brasileiro e decimal com ponto', () => {
  assert.equal(parseValorMonetario('R$ 199,90'), 199.9);
  assert.equal(parseValorMonetario('R$ 1.234,56'), 1234.56);
  assert.equal(parseValorMonetario('199.90'), 199.9);
  assert.equal(parseValorMonetario('1.234'), 1234);
  assert.equal(parseValorMonetario('sem preço'), null);
});

test('pedido preserva modelo e não confunde telefone com fone', () => {
  const p = interpretarPedidoLoja('Quero um fone Bluetooth até 199.90 reais de presente');
  assert.equal(p.termo, 'fone Bluetooth');
  assert.equal(p.budget, 199.9);
  assert.equal(p.categoria, 'fone');
  const celular = interpretarPedidoLoja('Preciso de um telefone até 1000');
  assert.equal(celular.categoria, 'celular');
  assert.equal(celular.termo, 'telefone');
});

test('match de produto exige tokens do pedido e respeita orçamento', () => {
  assert.equal(produtoCorresponde('Fone Bluetooth', 'fone Bluetooth'), true);
  assert.equal(produtoCorresponde('Teclado Mecânico', 'fone Bluetooth'), false);
  assert.equal(produtoCorresponde('Telefone celular', 'fone'), false);
});

test('confirmação de chat rejeita negação e aceita aprovação explícita', () => {
  assert.equal(confirmacaoChatLoja('Não quero enviar no chat da Americanas, não confirmo'), false);
  assert.equal(confirmacaoChatLoja('Não autorizo enviar no chat da Americanas: Quero um fone'), false);
  assert.equal(confirmacaoChatLoja('Envie no chat da Americanas: Quero um fone'), false);
  assert.equal(confirmacaoChatLoja('Envie no chat da Americanas: Quero um fone. Confirmo.'), true);
  assert.equal(confirmacaoChatLoja('Pode enviar no chat da Americanas: Quero um fone'), true);
  const d = decidir('Não quero enviar no chat da Americanas: Quero um fone, não confirmo');
  assert.equal(d.nome, 'loja_chat_enviar');
  assert.equal(d.args.confirmar, false);
});

test('texto do chat é extraído sem o comando nem a confirmação', () => {
  assert.equal(extrairTextoChat('Envie no chat da Americanas: Quero um fone até 250. Confirmo.'), 'Quero um fone até 250');
  assert.equal(extrairTextoChat('Pode enviar no chat da Americanas "Quero um fone"'), 'Quero um fone');
});
