import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { criarGateway, estadoGateway } from '../src/gateway.mjs';

test('gateway recupera token expirado antes de chamar a rota', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-gateway-'));
  const arquivo = path.join(dir, 'token.json');
  await writeFile(arquivo, JSON.stringify({ token: 'antigo', expiresAt: Date.now() - 1000 }));
  let chamadas = 0;
  const server = http.createServer((req, res) => {
    chamadas++;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: req.headers.authorization === 'Bearer novo' }));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try {
    const gateway = criarGateway({
      base: 'http://127.0.0.1:' + server.address().port,
      tokenFile: arquivo,
      recuperar: async () => { await writeFile(arquivo, JSON.stringify({ token: 'novo', expiresAt: Date.now() + 60000 })); },
    });
    assert.equal((await estadoGateway(arquivo)).ok, false);
    const r = await gateway.op('ping');
    assert.equal(r.ok, true);
    assert.equal(chamadas, 1);
    assert.equal((await gateway.status()).ok, true);
  } finally { await new Promise((r) => server.close(r)); await rm(dir, { recursive: true, force: true }); }
});
