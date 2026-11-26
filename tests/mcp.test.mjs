import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcp } from '../src/mcp.mjs';

test('MCP lista ferramentas atuais sem Google', async () => {
  const r = await handleMcp({ id: 1, method: 'tools/list' }, 'http://127.0.0.1:5188');
  const nomes = r.result.tools.map((t) => t.name);
  assert.ok(nomes.includes('myn_chat'));
  assert.ok(nomes.includes('myn_pesquisar'));
  assert.ok(nomes.includes('myn_mensagem'));
  assert.ok(nomes.includes('myn_planejar'));
  assert.ok(nomes.includes('myn_loop'));
  assert.ok(nomes.includes('myn_arquitetura'));
  assert.ok(nomes.includes('myn_desempenho'));
  assert.ok(nomes.includes('myn_modelos'));
  assert.ok(!nomes.includes('myn_google'));
});

test('MCP reconhece initialize e ping', async () => {
  const init = await handleMcp({ id: 2, method: 'initialize' }, 'http://127.0.0.1:5188');
  const ping = await handleMcp({ id: 3, method: 'ping' }, 'http://127.0.0.1:5188');
  assert.equal(init.result.serverInfo.name, 'myn-Recicla-01');
  assert.deepEqual(ping.result, {});
});
