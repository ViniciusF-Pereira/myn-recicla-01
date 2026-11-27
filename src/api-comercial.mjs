/** API comercial local: chaves revogáveis, planos, cota, uso e webhook assinado. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PLANOS_PADRAO = {
  gratuito: { nome: 'Gratuito', requisicoesDia: 100, rpm: 10, esforcos: ['low', 'medium'] },
  pro: { nome: 'Pro', requisicoesDia: 10000, rpm: 120, esforcos: ['low', 'medium', 'high'] },
};

function erroApi(status, codigo, mensagem) {
  const e = new Error(mensagem); e.status = status; e.codigo = codigo; return e;
}
function dia(agora) { return new Date(agora).toISOString().slice(0, 10); }
function hashChave(chave) { return createHash('sha256').update(String(chave)).digest('hex'); }

async function lerJson(arquivo, padrao) {
  try { return JSON.parse(await readFile(arquivo, 'utf8')); } catch { return padrao; }
}
async function salvarJson(arquivo, valor) {
  const tmp = arquivo + '.' + randomBytes(4).toString('hex') + '.tmp';
  await writeFile(tmp, JSON.stringify(valor, null, 2) + '\n', { mode: 0o600 });
  await rename(tmp, arquivo);
}
async function lerJsonl(arquivo) {
  try {
    return (await readFile(arquivo, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export function criarApiComercial({ dados, planos = PLANOS_PADRAO, agora = Date.now, webhook } = {}) {
  const dir = dados || path.join(process.cwd(), 'dados');
  const arquivoChaves = path.join(dir, 'api-chaves.json');
  const arquivoUso = path.join(dir, 'api-uso.jsonl');
  const baldes = new Map();
  const contadores = new Map();
  let fila = Promise.resolve();

  async function comLock(fn) {
    const anterior = fila;
    let soltar;
    fila = new Promise((resolve) => { soltar = resolve; });
    await anterior;
    try { return await fn(); } finally { soltar(); }
  }

  async function emitir(evento, dadosEvento) {
    if (!webhook?.url) return;
    try {
      const corpo = JSON.stringify({ id: 'evt_' + randomBytes(8).toString('hex'), evento, t: new Date(agora()).toISOString(), ...dadosEvento });
      const assinatura = webhook.secret ? 'sha256=' + createHmac('sha256', webhook.secret).update(corpo).digest('hex') : '';
      await fetch(webhook.url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-myn-event': evento, 'x-myn-signature': assinatura }, body: corpo, signal: AbortSignal.timeout(5000) });
    } catch { /* webhook não derruba a requisição */ }
  }

  async function chaves() { return lerJson(arquivoChaves, []); }
  async function gravarChaves(lista) { await mkdir(dir, { recursive: true }); await salvarJson(arquivoChaves, lista); }

  async function criarChave({ nome, plano = 'gratuito', expiresAt = null } = {}) {
    if (!nome || String(nome).length > 120) throw erroApi(400, 'nome_obrigatorio', 'nome da chave obrigatório');
    if (!planos[plano]) throw erroApi(400, 'plano_invalido', 'plano inexistente');
    const bruta = 'myn_sk_' + randomBytes(24).toString('base64url');
    const item = { id: 'key_' + randomBytes(8).toString('hex'), nome: String(nome), plano, prefixo: bruta.slice(0, 16), hash: hashChave(bruta), createdAt: agora(), expiresAt: expiresAt ? Number(expiresAt) : null, revokedAt: null, lastUsedAt: null };
    await comLock(async () => { const lista = await chaves(); lista.push(item); await gravarChaves(lista); });
    await emitir('chave.criada', { chave: item.id, plano });
    return { ...item, chave: bruta, hash: undefined };
  }

  async function listarChaves() {
    return (await chaves()).map(({ hash, ...item }) => ({ ...item, ativa: !item.revokedAt && (!item.expiresAt || item.expiresAt > agora()) }));
  }

  async function revogarChave(id) {
    return comLock(async () => {
      const lista = await chaves();
      const item = lista.find((k) => k.id === id);
      if (!item) throw erroApi(404, 'chave_inexistente', 'chave não encontrada');
      if (!item.revokedAt) item.revokedAt = agora();
      await gravarChaves(lista);
      await emitir('chave.revogada', { chave: item.id });
      return { ok: true, id: item.id, revokedAt: item.revokedAt };
    });
  }

  async function autenticar(chave) {
    if (!chave) throw erroApi(401, 'authentication_error', 'chave ausente ou inválida');
    const h = Buffer.from(hashChave(chave), 'hex');
    let item = null;
    for (const k of await chaves()) {
      const comparar = Buffer.from(k.hash || '', 'hex');
      if (comparar.length === h.length && timingSafeEqual(comparar, h)) { item = k; break; }
    }
    if (!item || item.revokedAt) throw erroApi(401, 'authentication_error', 'chave revogada ou inexistente');
    if (item.expiresAt && item.expiresAt <= agora()) throw erroApi(401, 'authentication_error', 'chave expirada');
    return item;
  }

  function permitirRpm(item) {
    const agoraMs = agora(), limite = planos[item.plano].rpm;
    const b = baldes.get(item.id) || { inicio: agoraMs, quantidade: 0 };
    if (agoraMs - b.inicio >= 60000) { b.inicio = agoraMs; b.quantidade = 0; }
    if (b.quantidade >= limite) return false;
    b.quantidade++; baldes.set(item.id, b); return true;
  }

  async function carregarContador(data) {
    if (contadores.has(data)) return contadores.get(data);
    const eventos = await lerJsonl(arquivoUso);
    const quantidade = eventos.filter((e) => e.dia === data && e.tipo === 'reserva').length;
    contadores.set(data, quantidade);
    return quantidade;
  }

  async function iniciarUso(chave, { rota = '/v1/agent', effort = 'medium' } = {}) {
    const item = await autenticar(chave);
    const plano = planos[item.plano];
    if (!plano.esforcos.includes(effort)) throw erroApi(403, 'effort_not_allowed', 'effort não permitido no plano ' + item.plano);
    if (!permitirRpm(item)) throw erroApi(429, 'rate_limit', 'limite por minuto excedido');
    const data = dia(agora());
    return comLock(async () => {
      const usado = await carregarContador(data);
      if (usado >= plano.requisicoesDia) {
        await emitir('cota.excedida', { chave: item.id, plano: item.plano, dia: data });
        throw erroApi(429, 'quota_exceeded', 'cota diária excedida');
      }
      contadores.set(data, usado + 1);
      const reserva = { id: 'uso_' + randomBytes(8).toString('hex'), tipo: 'reserva', dia: data, t: new Date(agora()).toISOString(), chave: item.id, plano: item.plano, rota, effort };
      await mkdir(dir, { recursive: true });
      await appendFile(arquivoUso, JSON.stringify(reserva) + '\n');
      return { item, reserva, uso: { usado: usado + 1, limite: plano.requisicoesDia, restante: plano.requisicoesDia - usado - 1, rpm: plano.rpm } };
    });
  }

  async function finalizarUso(sessao, { ok = true, latenciaMs = 0, via = '', erro = '' } = {}) {
    const evento = { id: 'fim_' + randomBytes(8).toString('hex'), tipo: 'fim', reserva: sessao.reserva.id, dia: sessao.reserva.dia, t: new Date(agora()).toISOString(), chave: sessao.item.id, plano: sessao.item.plano, ok, latenciaMs, via, erro: String(erro).slice(0, 300) };
    await appendFile(arquivoUso, JSON.stringify(evento) + '\n');
    await emitir('uso.registrado', evento);
    return evento;
  }

  async function lerUso(chave, limite = 100) {
    const item = await autenticar(chave);
    const data = dia(agora()), usado = await carregarContador(data), plano = planos[item.plano];
    const eventos = (await lerJsonl(arquivoUso)).filter((e) => e.chave === item.id).slice(-limite);
    return { chave: { id: item.id, nome: item.nome, plano: item.plano }, dia: data, usado, limite: plano.requisicoesDia, restante: plano.requisicoesDia - usado, rpm: plano.rpm, eventos };
  }

  async function metricas() {
    const eventos = await lerJsonl(arquivoUso);
    const fins = eventos.filter((e) => e.tipo === 'fim');
    const latencias = fins.map((e) => e.latenciaMs).sort((a, b) => a - b);
    const meio = Math.floor(latencias.length / 2);
    const p50 = !latencias.length ? 0 : latencias.length % 2 ? latencias[meio] : (latencias[meio - 1] + latencias[meio]) / 2;
    const p95 = latencias.length ? latencias[Math.min(latencias.length - 1, Math.floor(latencias.length * .95))] : 0;
    return { chaves: (await chaves()).length, requisicoes: eventos.filter((e) => e.tipo === 'reserva').length, concluidas: fins.length, falhas: fins.filter((e) => !e.ok).length, p50Ms: p50, p95Ms: p95, porPlano: Object.fromEntries(Object.keys(planos).map((p) => [p, eventos.filter((e) => e.tipo === 'reserva' && e.plano === p).length])) };
  }

  return { criarChave, listarChaves, revogarChave, autenticar, iniciarUso, finalizarUso, lerUso, metricas, planos };
}
