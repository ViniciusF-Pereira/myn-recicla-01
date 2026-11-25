/** Orquestrador no navegador. Usa somente APIs hospedadas; nunca binário/local. */
import { escolher, pontuar, relatorio, registrar } from '../verificacao/saude.mjs';
import { reparar } from '../tools/reparo.mjs';
import { executar } from '../tools/executor.mjs';

const BASE = window.MYN_API || location.origin;

async function api(caminho, corpo) {
  const r = await fetch(BASE + caminho, {
    method: corpo === undefined ? 'GET' : 'POST',
    headers: corpo === undefined ? {} : { 'content-type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
    signal: AbortSignal.timeout(90000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}

/** Roda uma tarefa em paralelo via API hospedada, pontuando cada rota. */
export async function orquestrar({ tarefa, max = 2, rapido = true }) {
  const inicio = Date.now();
  const d = await api('/api/orquestrar', { tarefa, max, rapido });
  for (const r of d.resultados || []) registrar(r.rota, { ok: r.ok, ms: r.ms, erro: r.erro || '' });
  return { ...d, ms: Date.now() - inicio, rotas: (d.resultados || []).map((r) => r.rota) };
}

/** Executa um passo planejado com ferramenta virtual quando o modelo pede TOOL. */
export async function executarPasso(passo) {
  const r = await api('/api/chat', { message: passo.entrada || passo.alvo, rota: passo.alvo === 'auto' ? 'auto' : 'auto' });
  const comando = reparar(r.reply || '');
  if (!comando) return { ok: false, detalhe: (r.reply || '').slice(0, 160), via: r.via };
  if (comando.acao) return { ok: true, acao: comando.acao, texto: comando.texto || '', via: r.via };
  const resultado = await executar(comando);
  return { ok: resultado.ok, detalhe: resultado.erro || resultado.nome || 'ok', via: r.via };
}

export async function plano(objetivo) { return api('/api/plan', { objetivo }); }
export async function stream(mensagem) { return api('/api/chat/stream?message=' + encodeURIComponent(mensagem)); }
export const saude = { escolher, pontuar, relatorio, registrar };
