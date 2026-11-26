/** Ponte Telegram ↔ Myn WORK. Token fica em dados/, nunca no Git. */
import { readFile, appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { assinar as assinarAnalise } from './worker-analise.mjs';
import { assinar as assinarMelhoria } from './worker-melhoria.mjs';
import { adquirirLock } from './lock.mjs';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
let config = null, ativo = false, offset = 0, timer = null, liberarLock = null;
let ultimoErro = null, ultimaMensagemEm = null, botUsername = '';

async function carregarConfig() {
  if (config) return config;
  const arquivo = process.env.MYN_TELEGRAM_TOKEN_FILE || path.join(DADOS, 'telegram-token.json');
  config = JSON.parse(await readFile(arquivo, 'utf8'));
  if (!config.token || !config.allowedUserId) throw new Error('configuração Telegram incompleta');
  return config;
}

async function api(metodo, params = {}, timeoutMs = 35000) {
  const c = await carregarConfig();
  const r = await fetch('https://api.telegram.org/bot' + c.token + '/' + metodo, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params), signal: AbortSignal.timeout(timeoutMs),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.description || 'Telegram HTTP ' + r.status);
  return d.result;
}

async function registrar(dados) {
  await mkdir(DADOS, { recursive: true });
  await appendFile(path.join(DADOS, 'telegram-ponte.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...dados }) + '\n').catch(() => {});
}

export async function enviarTelegram(texto) {
  await carregarConfig();
  const partes = String(texto || '').match(/[\s\S]{1,3800}/g) || ['Mensagem vazia.'];
  for (const parte of partes) {
    await api('sendMessage', { chat_id: config.allowedUserId, text: parte, disable_web_page_preview: true });
    ultimaMensagemEm = new Date().toISOString();
  }
}

export function statusPonte() {
  return { ativo, botUsername, allowedUserId: config?.allowedUserId || null, ultimoErro, ultimaMensagemEm };
}

async function responder(texto, base) {
  await api('sendChatAction', { chat_id: config.allowedUserId, action: 'typing' }, 10000);
  const r = await fetch(base + '/api/chat', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: texto, rota: 'auto' }), signal: AbortSignal.timeout(180000),
  });
  const d = await r.json();
  return d.reply || d.error || 'Não consegui responder.';
}

async function processarMensagem(msg, base) {
  if (!msg?.text || msg.from?.id !== config.allowedUserId) return;
  const texto = msg.text.trim();
  await registrar({ direcao: 'recebida', texto: texto.slice(0, 500) });
  let resposta;
  if (/^\/(start|ajuda|help)$/i.test(texto)) {
    resposta = 'Ponte WORK ↔ Telegram ativa.\n\nEnvie qualquer mensagem para conversar.\n/status — workers e arquitetura\n/worker — estado dos workers\n/ajuda — esta ajuda';
  } else if (/^\/status$/i.test(texto)) {
    const [a, m, arq] = await Promise.all([
      fetch(base + '/api/worker-analise/status').then((r) => r.json()),
      fetch(base + '/api/worker-melhoria/status').then((r) => r.json()),
      fetch(base + '/api/arquitetura').then((r) => r.json()),
    ]);
    resposta = `WORK online\nAnálise: ${a.ativo ? 'ativa' : 'parada'} · ciclo ${a.ciclos}\nMelhoria: ${m.ativo ? 'ativa' : 'parada'} · ciclo ${m.ciclos}\nArquitetura: ${arq.resumo.modulos} módulos · ${arq.resumo.violacoes} violações`;
  } else if (/^\/worker$/i.test(texto)) {
    const m = await fetch(base + '/api/worker-melhoria/status').then((r) => r.json());
    resposta = `Worker melhoria: ${m.ativo ? 'ativo' : 'parado'}\nCiclos: ${m.ciclos}\nÚltimo: ${m.ultimo?.tipo || '—'}\n${m.ultimo?.aviso || ''}`;
  } else {
    resposta = await responder(texto, base);
  }
  await enviarTelegram(resposta);
  await registrar({ direcao: 'enviada', texto: String(resposta).slice(0, 500) });
}

async function poll(base) {
  if (!ativo) return;
  try {
    const updates = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] }, 30000);
    for (const u of updates) {
      offset = u.update_id + 1;
      await processarMensagem(u.message, base);
    }
    ultimoErro = null;
  } catch (e) { ultimoErro = String(e.message).slice(0, 240); }
  finally { if (ativo) timer = setTimeout(() => poll(base).catch(() => {}), 1500); }
}

function assinarEventos() {
  const importante = (ev) => ['achado', 'engenharia_aplicada', 'merge_bloqueado', 'revertido', 'bloqueado'].includes(ev.tipo);
  const cancelarA = assinarAnalise((ev) => { if (importante(ev)) enviarTelegram('🔎 ' + ev.tipo + (ev.descricao ? ': ' + ev.descricao : '')).catch(() => {}); });
  const cancelarM = assinarMelhoria((ev) => {
    if (!importante(ev)) return;
    const texto = ev.tipo === 'engenharia_aplicada' ? `🛠 ${ev.id} · ${ev.arquivo} · merge=${ev.merge}` : `⚠️ ${ev.tipo}${ev.aviso ? ': ' + ev.aviso : ''}`;
    enviarTelegram(texto).catch(() => {});
  });
  return () => { cancelarA(); cancelarM(); };
}

export async function iniciarPonteTelegram({ base = 'http://127.0.0.1:' + (process.env.PORTA || 5188) } = {}) {
  if (ativo) return { ok: false, erro: 'ponte já ativa' };
  const lock = await adquirirLock('telegram');
  if (!lock.ok) return { ok: false, erro: lock.motivo };
  liberarLock = lock.liberar;
  try {
    config = await carregarConfig();
    const me = await api('getMe');
    botUsername = me.username || '';
    ativo = true;
    const cancelar = assinarEventos();
    const parar = () => { ativo = false; clearTimeout(timer); cancelar(); liberarLock?.(); liberarLock = null; };
    timer = setTimeout(() => poll(base), 100);
    await enviarTelegram(`Ponte WORK ↔ Telegram ativa.\nBot: @${botUsername}\nEnvie uma mensagem para conversar. /status mostra os workers.`);
    await registrar({ direcao: 'sistema', evento: 'iniciada', botUsername });
    return { ok: true, status: statusPonte(), parar };
  } catch (e) {
    ativo = false; ultimoErro = String(e.message).slice(0, 240);
    await liberarLock?.(); liberarLock = null;
    return { ok: false, erro: ultimoErro };
  }
}
