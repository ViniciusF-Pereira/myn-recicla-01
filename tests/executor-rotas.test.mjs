import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';


test('conversa tenta outra rota quando a primeira falha e fixa a vencedora', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-rotas-'));
  process.env.MYN_DADOS = dir;
  const { executarConversa } = await import('../src/executor-rotas.mjs');
  const { preferencias } = await import('../src/memoria.mjs');
  const original = globalThis.fetch;
  const plugins = [
    { id: 'pollinations-text-api', nome: 'Pollinations', acao: 'api', api: { url: 'http://primeiro/{encode}', tipo: 'texto' } },
    { id: 'brave-leo', nome: 'Brave', acao: 'api', api: { url: 'http://segundo/{encode}', tipo: 'texto' } },
  ];
  globalThis.fetch = async (url) => String(url).includes('primeiro') ? new Response('erro', { status: 400 }) : new Response('resposta da segunda rota', { status: 200 });
  try {
    const r = await executarConversa({ texto: 'converse comigo', sessao: 'conversa-1', plugins });
    assert.equal(r.ok, true);
    assert.equal(r.via, 'brave-leo');
    assert.equal((await preferencias('conversa-1')).rota, 'brave-leo');
  } finally { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); }
});
