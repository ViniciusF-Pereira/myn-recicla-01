import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { criarApiComercial } from '../src/api-comercial.mjs';

test('API comercial cria chave sem persistir o segredo e revoga', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-api-'));
  try {
    const api = criarApiComercial({ dados: dir, agora: () => 1795800000000 });
    const criada = await api.criarChave({ nome: 'app cliente', plano: 'pro' });
    assert.match(criada.chave, /^myn_sk_/);
    assert.equal(criada.hash, undefined);
    const cru = await readFile(path.join(dir, 'api-chaves.json'), 'utf8');
    assert.ok(!cru.includes(criada.chave));
    assert.equal((await api.autenticar(criada.chave)).id, criada.id);
    const lista = await api.listarChaves();
    assert.equal(lista.length, 1);
    assert.equal(lista[0].chave, undefined);
    assert.equal(lista[0].hash, undefined);
    await api.revogarChave(criada.id);
    await assert.rejects(() => api.autenticar(criada.chave), (e) => e.status === 401 && e.codigo === 'authentication_error');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('API comercial aplica cota diária e rate limit por plano', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-api-cota-'));
  let agora = 1795800000000;
  try {
    const api = criarApiComercial({ dados: dir, agora: () => agora, planos: {
      gratuito: { nome: 'Gratuito', requisicoesDia: 2, rpm: 2, esforcos: ['low', 'medium'] },
      pro: { nome: 'Pro', requisicoesDia: 10, rpm: 5, esforcos: ['low', 'medium', 'high'] },
    } });
    const { chave } = await api.criarChave({ nome: 'cota', plano: 'gratuito' });
    const a = await api.iniciarUso(chave, { effort: 'low' });
    await api.finalizarUso(a, { ok: true, latenciaMs: 12, via: 'teste' });
    const b = await api.iniciarUso(chave, { effort: 'medium' });
    await api.finalizarUso(b, { ok: false, latenciaMs: 20, erro: 'cota do provedor' });
    await assert.rejects(() => api.iniciarUso(chave, { effort: 'low' }), (e) => e.status === 429 && e.codigo === 'rate_limit');
    agora += 61000;
    await assert.rejects(() => api.iniciarUso(chave, { effort: 'low' }), (e) => e.status === 429 && e.codigo === 'quota_exceeded');
    await assert.rejects(() => api.iniciarUso(chave, { effort: 'high' }), (e) => e.status === 403 && e.codigo === 'effort_not_allowed');
    const uso = await api.lerUso(chave);
    assert.equal(uso.usado, 2);
    assert.equal(uso.limite, 2);
    assert.equal(uso.eventos.filter((e) => e.tipo === 'fim').length, 2);
    const metricas = await api.metricas();
    assert.equal(metricas.requisicoes, 2);
    assert.equal(metricas.falhas, 1);
    assert.equal(metricas.p50Ms, 16);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('API comercial envia webhook assinado sem derrubar a operação', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-api-webhook-'));
  const original = globalThis.fetch;
  const chamadas = [];
  globalThis.fetch = async (url, options) => { chamadas.push({ url, options }); return new Response('ok'); };
  try {
    const api = criarApiComercial({ dados: dir, webhook: { url: 'https://exemplo.test/webhook', secret: 'segredo-teste' } });
    const { chave, id } = await api.criarChave({ nome: 'webhook' });
    assert.equal(chamadas.length, 1);
    assert.match(chamadas[0].options.headers['x-myn-signature'], /^sha256=/);
    const sessao = await api.iniciarUso(chave);
    await api.finalizarUso(sessao, { ok: true, via: 'teste' });
    assert.ok(chamadas.some((c) => c.options.headers['x-myn-event'] === 'uso.registrado'));
    assert.ok(chamadas.some((c) => JSON.parse(c.options.body).chave === id));
  } finally { globalThis.fetch = original; await rm(dir, { recursive: true, force: true }); }
});
