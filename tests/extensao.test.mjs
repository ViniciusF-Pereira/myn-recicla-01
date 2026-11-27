import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { normalizarEffort, normalizarRota, selecionarRotas } from '../web/core/rotas-cliente.mjs';

test('manifest da extensão é MV3 e não pede acesso amplo', async () => {
  const manifesto = JSON.parse(await readFile('site/extensao/manifest.json', 'utf8'));
  assert.equal(manifesto.manifest_version, 3);
  assert.ok(manifesto.permissions.includes('sidePanel'));
  assert.ok(manifesto.permissions.includes('scripting'));
  assert.ok(manifesto.permissions.includes('activeTab'));
  assert.ok(!manifesto.host_permissions.includes('<all_urls>'));
  assert.ok(!manifesto.optional_host_permissions.includes('<all_urls>'));
  assert.ok(manifesto.optional_host_permissions.every((p) => /^https:\/\//.test(p)));
  assert.ok(manifesto.optional_host_permissions.length >= 20);
  assert.ok(!JSON.stringify(manifesto).match(/google|gemini/i));
  assert.deepEqual(Object.keys(manifesto.icons), ['16', '32', '48', '128']);
  for (const arquivo of Object.values(manifesto.icons)) assert.ok((await stat('site/extensao/' + arquivo)).size > 100);
  const zip = await readFile('site/extensao/myn-recicla-extensao.zip');
  assert.equal(zip.subarray(0, 4).toString(), 'PK\u0003\u0004');
  assert.ok(zip.length > 10000);
});

test('cliente normaliza aliases e limita rotas pelo effort', () => {
  assert.equal(normalizarEffort(' HIGH '), 'high');
  assert.equal(normalizarEffort('outro'), 'medium');
  assert.equal(normalizarRota('chatgpt'), 'chatgpt-web');
  assert.equal(normalizarRota('hugging'), 'huggingchat');
  assert.deepEqual(selecionarRotas({ effort: 'low' }), ['pollinations-text-api']);
  assert.deepEqual(selecionarRotas({ effort: 'medium' }), ['pollinations-text-api', 'webgpu-local']);
  assert.deepEqual(selecionarRotas({ effort: 'high' }), ['pollinations-text-api', 'webgpu-local']);
  assert.deepEqual(selecionarRotas({ effort: 'high', extensaoDisponivel: true }), ['pollinations-text-api', 'chatgpt-web', 'claude-web']);
  assert.deepEqual(selecionarRotas({ rota: 'chatgpt', extensaoDisponivel: false }), ['chatgpt-web']);
});

test('ponte da extensão valida origem e máscara de canais', async () => {
  const conteudo = await readFile('site/extensao/content-script.js', 'utf8');
  const fundo = await readFile('site/extensao/background.js', 'utf8');
  assert.match(conteudo, /event\.source !== window/);
  assert.match(conteudo, /event\.origin !== location\.origin/);
  assert.match(fundo, /SITE_PERMITIDO/);
  assert.match(fundo, /permissão necessária/);
  assert.match(fundo, /descobrir_aba_atual/);
  assert.match(fundo, /cancelar_operacao/);
  assert.match(fundo, /CATALOGO_CHATS/);
  const rotas = await readFile('site/extensao/rotas.js', 'utf8');
  assert.match(rotas, /myn-teste-local/);
  assert.match(rotas, /oculta: true/);
});

test('site oferece download e modo extensão', async () => {
  const home = await readFile('site/index.html', 'utf8');
  const play = await readFile('site/playground.html', 'utf8');
  const js = await readFile('site/playground.js', 'utf8');
  assert.match(home, /myn-recicla-extensao\.zip/);
  assert.match(play, /id="btnExtensao"/);
  assert.match(js, /window\.myn\.cliente\.conversar/);
  assert.match(js, /MODO_EXTENSAO/);
  assert.match(play, /id="painelMemoria"/);
  assert.match(js, /window\.myn\.memoria\.exportar/);
  assert.match(js, /window\.myn\.rag\.exportar/);
  const server = await readFile('scripts/site-server.mjs', 'utf8');
  assert.match(server, /frame-ancestors chrome-extension:/);
});
