import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { handleAnthropic } from '../src/api-antropic.mjs';

function respostaMock() {
  return { status: 0, headers: {}, corpo: '', eventos: '', writeHead(s, h) { this.status = s; this.headers = h; }, end(b = '') { this.corpo += b; }, write(b) { this.eventos += b; } };
}

async function comMock(fn, captura = null) {
  const server = http.createServer(async (req, res) => {
    let corpo = ''; for await (const p of req) corpo += p;
    const rota = req.url;
    if (rota === '/api/agente' && captura) captura.push(JSON.parse(corpo || '{}'));
    res.setHeader('content-type', 'application/json');
    if (rota === '/api/chat') return res.end(JSON.stringify({ reply: 'Resposta local do Myn.', via: 'conhecimento-local' }));
    if (rota === '/api/agente') return res.end(JSON.stringify({ resposta: 'Resposta local do Myn.', via: 'conhecimento-local', passos: [] }));
    if (rota === '/api/rag') return res.end(JSON.stringify({ resultados: [{ trecho: 'contexto local' }] }));
    res.statusCode = 404; res.end('{}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn('http://127.0.0.1:' + server.address().port); }
  finally { await new Promise((r) => server.close(r)); }
}

test('Messages API devolve formato Anthropic com thinking', async () => {
  await comMock(async (base) => {
    const res = respostaMock();
    await handleAnthropic({ body: { model: 'myn-auto', max_tokens: 200, thinking: { type: 'enabled' }, messages: [{ role: 'user', content: 'Explique o Myn.' }] }, req: {}, res, base });
    const d = JSON.parse(res.corpo);
    assert.equal(res.status, 200);
    assert.equal(d.type, 'message');
    assert.equal(d.role, 'assistant');
    assert.equal(d.content[0].type, 'thinking');
    assert.equal(d.content[1].type, 'text');
    assert.equal(d.stop_reason, 'end_turn');
    assert.ok(d.usage.output_tokens > 0);
  });
});

test('Messages API devolve tool_use quando a tarefa corresponde a uma tool', async () => {
  await comMock(async (base) => {
    const res = respostaMock();
    await handleAnthropic({ body: { model: 'myn-auto', messages: [{ role: 'user', content: 'pesquise sobre worker' }], tools: [{ name: 'search', input_schema: { type: 'object' } }] }, req: {}, res, base });
    const d = JSON.parse(res.corpo);
    assert.equal(d.stop_reason, 'tool_use');
    assert.equal(d.content[0].type, 'tool_use');
    assert.equal(d.content[0].name, 'search');
  });
});

test('Messages API repassa effort high ao núcleo', async () => {
  const captura = [];
  await comMock(async (base) => {
    const res = respostaMock();
    await handleAnthropic({ body: { model: 'myn-auto', effort: 'high', messages: [{ role: 'user', content: 'Explique o Myn.' }] }, req: {}, res, base });
    assert.equal(res.status, 200);
  }, captura);
  assert.equal(captura[0].effort, 'high');
});

test('Messages API streaming emite eventos Anthropic', async () => {
  await comMock(async (base) => {
    const res = respostaMock();
    await handleAnthropic({ body: { model: 'myn-auto', stream: true, messages: [{ role: 'user', content: 'oi' }] }, req: {}, res, base });
    assert.match(res.eventos, /message_start/);
    assert.match(res.eventos, /content_block_delta/);
    assert.match(res.eventos, /message_stop/);
  });
});
