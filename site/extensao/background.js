import { ROTAS, rotaPorId } from './rotas.js';

const SITE_PERMITIDO = /^https:\/\/mynrecicla\.com$|^http:\/\/127\.0\.0\.1:5188$/;

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

async function origemPermitida(origem) {
  try { return await chrome.permissions.contains({ origins: [origem + '/*'] }); }
  catch { return false; }
}

async function esperarCarregamento(tabId, ms = 30000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') return tab;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('a página demorou demais para carregar');
}

async function injetar(tabId, func, args = []) {
  const resultados = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return resultados?.[0]?.result ?? null;
}

function prepararEnvio({ seletor, texto }) {
  const campo = document.querySelector(seletor);
  if (!campo) return { ok: false, erro: 'composer não encontrado; a rota pode exigir login' };
  campo.focus();
  if (campo.isContentEditable) {
    campo.textContent = texto;
    campo.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: texto }));
  } else {
    const prototipo = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(campo, texto);
    campo.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: texto }));
  }
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}

function acionarEnvio() {
  const botoes = [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Enviar" i]',
    'button[type="submit"]',
  ];
  for (const seletor of botoes) {
    const botao = document.querySelector(seletor);
    if (botao && !botao.disabled) { botao.click(); return { ok: true }; }
  }
  const campo = document.activeElement;
  if (campo) {
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    campo.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { ok: true };
  }
  return { ok: false, erro: 'não foi possível enviar' };
}

function lerResposta({ seletor }) {
  const nodes = [...document.querySelectorAll(seletor)];
  const textos = nodes.map((n) => n.innerText || n.textContent || '').filter(Boolean);
  return { textos: textos.slice(-4), ultimo: textos.at(-1) || '', total: textos.length };
}

async function executarRota({ rotaId, texto }) {
  const rota = rotaPorId(rotaId);
  if (!rota) throw new Error('rota não suportada pela extensão');
  if (!(await origemPermitida(rota.origem))) {
    throw new Error('permissão necessária para ' + rota.origem + '; autorize no painel da extensão');
  }
  const abas = await chrome.tabs.query({ url: rota.origem + '/*' });
  let aba = abas.find((t) => t.url === rota.url);
  if (!aba) aba = await chrome.tabs.create({ url: rota.url, active: true });
  else await chrome.tabs.update(aba.id, { active: true });
  await esperarCarregamento(aba.id);
  const antes = await injetar(aba.id, lerResposta, [{ seletor: rota.resposta }]);
  const preparado = await injetar(aba.id, prepararEnvio, [{ seletor: rota.seletor, texto: String(texto).slice(0, 6000) }]);
  if (!preparado?.ok) throw new Error(preparado?.erro || 'composer indisponível');
  await new Promise((r) => setTimeout(r, 300));
  const envio = await injetar(aba.id, acionarEnvio);
  if (!envio?.ok) throw new Error(envio?.erro || 'envio não confirmado');

  const fim = Date.now() + 90000;
  let ultimo = '', estavel = 0;
  while (Date.now() < fim) {
    await new Promise((r) => setTimeout(r, 1500));
    const atual = await injetar(aba.id, lerResposta, [{ seletor: rota.resposta }]);
    const novidades = (atual?.textos || []).filter((t) => !(antes?.textos || []).includes(t));
    const candidato = novidades.at(-1) || (atual?.total > (antes?.total || 0) ? atual.ultimo : '');
    if (!candidato) continue;
    if (candidato === ultimo) estavel++; else { ultimo = candidato; estavel = 0; }
    if (estavel >= 2 && candidato.length > 2) return { ok: true, texto: candidato, via: 'extensao:' + rota.id };
  }
  throw new Error('a rota não devolveu uma resposta estável em 90 segundos');
}

async function abrirVM(tabId) {
  if (!tabId) throw new Error('abra o Myn em uma aba antes de abrir a VM');
  await chrome.sidePanel.open({ tabId });
  return { ok: true };
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  (async () => {
    if (!SITE_PERMITIDO.test(mensagem?.origemPagina || '')) throw new Error('origem não autorizada');
    if (mensagem.tipo === 'ping') return { ok: true, versao: chrome.runtime.getManifest().version, rotas: ROTAS.filter((r) => !r.oculta).map((r) => r.id) };
    if (mensagem.tipo === 'abrir_vm') return abrirVM(remetente.tab?.id);
    if (mensagem.tipo === 'listar_rotas') return { ok: true, rotas: ROTAS.filter((r) => !r.oculta) };
    if (mensagem.tipo === 'executar_rota') return executarRota(mensagem);
    throw new Error('operação desconhecida');
  })().then(responder).catch((erro) => responder({ ok: false, erro: String(erro.message).slice(0, 300) }));
  return true;
});
