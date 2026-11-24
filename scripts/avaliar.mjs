/** Bateria de avaliação do Myn Recyla/01. Mede rotas reais e grava docs/AVALIACAO.md. */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const resultados = [];
async function medir(nome, fn) {
  const t = Date.now();
  try {
    const r = await fn();
    const ms = Date.now() - t;
    const ok = r.ok !== false && r.status !== 0;
    resultados.push({ nome, ok, ms, detalhe: String(r.detalhe || '').slice(0, 180) });
    console.log((ok ? 'OK  ' : 'FALHA') + ' ' + nome.padEnd(22) + String(ms).padStart(6) + 'ms ' + String(r.detalhe || '').slice(0, 70));
  } catch (e) {
    resultados.push({ nome, ok: false, ms: Date.now() - t, detalhe: String(e.message).slice(0, 160) });
    console.log('FALHA ' + nome.padEnd(22) + ' ' + e.message.slice(0, 90));
  }
}
const json = async (u, o) => { const r = await fetch(BASE + u, o); const d = await r.json().catch(() => ({})); return { status: r.status, ok: r.ok, dados: d }; };

await medir('site', async () => { const r = await fetch(BASE + '/'); return { ok: r.status === 200, detalhe: 'HTTP ' + r.status }; });
await medir('plugins', async () => { const r = await json('/api/plugins'); return { ok: r.dados.total > 50, detalhe: r.dados.total + ' plugins, ' + r.dados.plugins.filter((p) => p.conta === 'google').length + ' google' }; });
await medir('saude', async () => { const r = await json('/api/saude'); return { ok: Array.isArray(r.dados.rotas), detalhe: r.dados.rotas?.length + ' rotas pontuadas' }; });
await medir('google', async () => { const r = await json('/api/google'); return { ok: Array.isArray(r.dados.rotas), detalhe: (r.dados.conta || 'sem conta') + ' · ' + r.dados.rotas?.length + ' rotas' }; });
await medir('historico', async () => { const r = await json('/api/historico?limite=5'); return { ok: Array.isArray(r.dados.itens), detalhe: r.dados.itens?.length + ' itens' }; });
await medir('cache', async () => { const r = await json('/api/cache'); return { ok: Array.isArray(r.dados.itens), detalhe: r.dados.itens?.length + ' chaves' }; });
await medir('chat-auto', async () => { const r = await json('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: 'Explique reciclagem em uma frase', rota: 'auto' }), signal: AbortSignal.timeout(60000) }); return { ok: r.ok && (r.dados.reply || '').length > 5, detalhe: (r.dados.via || '?') + ' · ' + (r.dados.reply || '').slice(0, 60) }; });
await medir('stream-sse', async () => {
  const t = Date.now(); const r = await fetch(BASE + '/api/chat/stream?message=' + encodeURIComponent('Oi, responda OK'), { signal: AbortSignal.timeout(60000) });
  const rd = r.body.getReader(); let primeiro = null, n = 0;
  while (n < 4000) { const { done, value } = await rd.read(); if (done) break; const txt = Buffer.from(value || '').toString('utf8'); if (/"done":true/.test(txt)) break; if (!primeiro) primeiro = Date.now() - t; n++; }
  return { ok: primeiro !== null, detalhe: 'primeiro token ' + primeiro + 'ms' };
});
await medir('plan', async () => { const r = await json('/api/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ objetivo: 'melhorar as rotas do Myn' }), signal: AbortSignal.timeout(60000) }); return { ok: r.dados.passos?.length > 0, detalhe: r.dados.via + ' · ' + r.dados.passos?.length + ' passos' }; });
await medir('orquestrar-rapido', async () => { const r = await json('/api/orquestrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tarefa: 'explique reciclagem', max: 2, rapido: true }), signal: AbortSignal.timeout(60000) }); return { ok: r.dados.resultados?.some((x) => x.ok), detalhe: 'vencedor ' + (r.dados.vencedor?.rota || '?') + ' · ' + (r.dados.resultados?.filter((x) => x.ok).length || 0) + '/' + r.dados.resultados?.length + ' rotas ok' }; });
await medir('midia-imagem', async () => { const r = await json('/api/midia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'imagem', prompt: 'cachorro com moicano' }), signal: AbortSignal.timeout(120000) }); return { ok: Boolean(r.dados.url), detalhe: r.dados.fonte }; });
await medir('midia-audio', async () => { const r = await json('/api/midia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'audio', prompt: 'Olá, isso é um teste do Myn' }), signal: AbortSignal.timeout(120000) }); return { ok: Boolean(r.dados.url), detalhe: r.dados.fonte }; });
await medir('midia-video', async () => { const r = await json('/api/midia', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'video', prompt: 'cachorro com moicano andando de skate', segundos: 4 }), signal: AbortSignal.timeout(120000) }); return { ok: Boolean(r.dados.url), detalhe: r.dados.fonte }; });
await medir('documento-csv', async () => { const b64 = Buffer.from('a,b\n1,2\n', 'utf8').toString('base64'); const r = await json('/api/documento', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: 'avaliacao.csv', base64: b64 }) }); return { ok: (r.dados.texto || '').includes('a,b'), detalhe: (r.dados.texto || '').slice(0, 40) }; });
await medir('mcp-tools', async () => {
  const r = await json('/mcp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  return { ok: r.dados.result?.tools?.length > 5, detalhe: (r.dados.result?.tools?.length || 0) + ' ferramentas MCP' };
});

const ok = resultados.filter((r) => r.ok).length;
const linhas = [
  '# Avaliação automática — Myn Recyla/01',
  '',
  'Gerada por `node scripts/avaliar.mjs` em ' + new Date().toISOString() + '.',
  '',
  '**' + ok + '/' + resultados.length + ' baterias OK**',
  '',
  '| Bateria | Status | Tempo | Detalhe |',
  '|---|---|---|---|',
  ...resultados.map((r) => '| ' + r.nome + ' | ' + (r.ok ? 'OK' : 'FALHA') + ' | ' + r.ms + 'ms | ' + r.detalhe.replace(/\|/g, '/') + ' |'),
  '',
];
await writeFile(path.join(RAIZ, 'docs', 'AVALIACAO.md'), linhas.join('\n'));
console.log('\nRESULTADO ' + ok + '/' + resultados.length + ' → docs/AVALIACAO.md');
