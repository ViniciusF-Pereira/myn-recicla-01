import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';


test('conversa tenta outra rota quando a primeira falha e fixa a vencedora', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-rotas-'));
  process.env.MYN_DADOS = dir;
  const { executarConversa, selecionarRotas } = await import('../src/executor-rotas.mjs');
  const { preferencias } = await import('../src/memoria.mjs');
  const original = globalThis.fetch;
  const plugins = [
    { id: 'pollinations-text-api', nome: 'Pollinations', acao: 'api', api: { url: 'http://pollinations-text-api/{encode}', tipo: 'texto' } },
    { id: 'brave-leo', nome: 'Brave', acao: 'api', api: { url: 'http://brave-leo/{encode}', tipo: 'texto' } },
  ];
  try {
    const rotas = await selecionarRotas({ texto: 'converse comigo', sessao: 'conversa-1', plugins, max: 2 });
    assert.equal(rotas.length, 2);
    const primeira = rotas[0].id, segunda = rotas[1].id;
    globalThis.fetch = async (url) => String(url).includes('/' + primeira + '/') ? new Response('erro', { status: 400 }) : new Response('resposta da segunda rota', { status: 200 });
    const r = await executarConversa({ texto: 'converse comigo', sessao: 'conversa-1', plugins });
    assert.equal(r.ok, true);
    assert.equal(r.via, segunda);
    assert.equal(r.tentativas, 2);
    assert.equal((await preferencias('conversa-1')).rota, segunda);
    const fixa = await selecionarRotas({ texto: 'converse comigo', sessao: 'conversa-1', plugins, max: 1 });
    assert.equal(fixa[0].id, segunda);
  } finally { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); }
});

test('effort low limita a conversa a uma única rota', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-rotas-low-'));
  process.env.MYN_DADOS = dir;
  const { executarConversa } = await import('../src/executor-rotas.mjs');
  const original = globalThis.fetch;
  let chamadas = 0;
  const plugins = [
    { id: 'pollinations-text-api', nome: 'Pollinations', acao: 'api', api: { url: 'http://primeiro/{encode}', tipo: 'texto' } },
    { id: 'brave-leo', nome: 'Brave', acao: 'api', api: { url: 'http://segundo/{encode}', tipo: 'texto' } },
  ];
  globalThis.fetch = async () => { chamadas++; return new Response('erro', { status: 400 }); };
  try {
    const r = await executarConversa({ texto: 'converse comigo', sessao: 'conversa-low', plugins, maxRotas: 1 });
    assert.equal(r.ok, false);
    assert.equal(chamadas, 1);
    assert.equal(r.erros.length, 1);
  } finally { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); }
});
