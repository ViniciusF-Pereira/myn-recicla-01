import { ROTAS, VERSAO_ADAPTADORES, rotaPorId } from './rotas.js';
import { CATALOGO_CHATS } from './catalogo-chats.js';
import { registrarResultado, pontuar } from './saude.mjs';
import { mapearPagina, criarAdaptador } from './descoberta.mjs';

const SITE_PERMITIDO = /^https:\/\/mynrecicla\.com$|^http:\/\/127\.0\.0\.1:5188$/;
const CHAVE_SAUDE = 'myn-saude-rotas-v1';
const CHAVE_DESCOBERTAS = 'myn-descobertas-v1';
const CHAVE_ADAPTADORES = 'myn-adaptadores-descobertos-v1';
let saudeCache = {};

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

function erroRota(codigo, mensagem, rota, etapa) {
  const e = new Error(mensagem); e.codigo = codigo; e.rota = rota?.id; e.etapa = etapa; e.versaoAdaptador = rota?.versao; return e;
}
async function carregarSaude() {
  if (Object.keys(saudeCache).length) return saudeCache;
  saudeCache = (await chrome.storage.local.get(CHAVE_SAUDE))[CHAVE_SAUDE] || {};
  return saudeCache;
}
async function registrarSaude(rota, ok, ms, erro = '') {
  const atual = await carregarSaude();
  atual[rota.id] = registrarResultado(atual[rota.id], { ok, ms, erro });
  saudeCache = atual;
  await chrome.storage.local.set({ [CHAVE_SAUDE]: atual });
}
async function origemPermitida(origem) {
  try { return await chrome.permissions.contains({ origins: [origem + '/*'] }); } catch { return false; }
}
async function exigirAcessoInicial(rota) {
  if (await origemPermitida(rota.origem)) return;
  // activeTab pode autorizar temporariamente uma aba descoberta; abrirAba exige que ela já exista.
  if (!rota.descoberta) throw erroRota('permissao_necessaria', 'permissão necessária para ' + rota.origem + '; autorize no painel da extensão', rota, 'permissao');
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
function diagnosticarLayout({ campos, respostas, login }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const encontrar = (seletores) => {
    for (const seletor of seletores || []) {
      try { const el = document.querySelector(seletor); if (visivel(el)) return el; } catch { /* seletor inválido */ }
    }
    return null;
  };
  const campo = encontrar(campos), resposta = encontrar(respostas), loginEl = encontrar(login);
  return { composer: Boolean(campo), resposta: Boolean(resposta), login: Boolean(loginEl), url: location.href, titulo: document.title };
}
function prepararEnvio({ campos, texto }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const encontrar = (seletores) => {
    for (const seletor of seletores || []) {
      try { const el = document.querySelector(seletor); if (visivel(el)) return el; } catch { /* seletor inválido */ }
    }
    return null;
  };
  const campo = encontrar(campos);
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
function acionarEnvio({ envio }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  for (const seletor of envio || []) {
    try { const botao = document.querySelector(seletor); if (visivel(botao) && !botao.disabled) { botao.click(); return { ok: true }; } } catch { /* continua */ }
  }
  const campo = document.activeElement;
  if (campo) {
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    campo.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { ok: true };
  }
  return { ok: false, erro: 'não foi possível enviar' };
}
function lerResposta({ respostas }) {
  const textos = [];
  for (const seletor of respostas || []) {
    try { for (const n of document.querySelectorAll(seletor)) { const t = n.innerText || n.textContent || ''; if (t.trim()) textos.push(t.trim()); } } catch { /* continua */ }
  }
  const unicos = [...new Set(textos)];
  return { textos: unicos.slice(-4), ultimo: unicos.at(-1) || '', total: unicos.length };
}
async function abrirAba(rota) {
  const abas = await chrome.tabs.query({ url: rota.origem + '/*' });
  let aba = abas.find((t) => t.url === rota.url);
  if (!aba) {
    if (!(await origemPermitida(rota.origem))) throw erroRota('permissao_necessaria', 'permissão necessária para ' + rota.origem + '; autorize no painel da extensão', rota, 'permissao');
    aba = await chrome.tabs.create({ url: rota.url, active: true });
  } else await chrome.tabs.update(aba.id, { active: true });
  await esperarCarregamento(aba.id);
  return aba;
}
async function adaptadoresDescobertos() {
  return (await chrome.storage.local.get(CHAVE_ADAPTADORES))[CHAVE_ADAPTADORES] || [];
}
async function obterRota(id) {
  return rotaPorId(id) || (await adaptadoresDescobertos()).find((r) => r.id === id) || null;
}
async function listarRotas() {
  const saude = await carregarSaude();
  const rotas = [...ROTAS, ...await adaptadoresDescobertos()];
  return rotas.filter((r) => !r.oculta).map((r) => ({ ...r, saude: pontuar(r.id, saude[r.id]) }));
}
async function diagnosticar(rotaId) {
  const rota = await obterRota(rotaId);
  if (!rota) throw erroRota('rota_inexistente', 'rota não suportada pela extensão', null, 'validar');
  await exigirAcessoInicial(rota);
  const aba = await abrirAba(rota);
  const layout = await injetar(aba.id, diagnosticarLayout, [{ campos: rota.campos, respostas: rota.respostas, login: rota.login }]);
  const saude = await carregarSaude();
  return { ok: true, rota: rota.id, versaoAdaptador: rota.versao, layout, saude: pontuar(rota.id, saude[rota.id]), modoManual: !layout?.composer };
}
async function executarRota({ rotaId, texto }) {
  const rota = await obterRota(rotaId), inicio = Date.now();
  if (!rota) throw erroRota('rota_inexistente', 'rota não suportada pela extensão', null, 'validar');
  try {
    await exigirAcessoInicial(rota);
    const aba = await abrirAba(rota);
    const layout = await injetar(aba.id, diagnosticarLayout, [{ campos: rota.campos, respostas: rota.respostas, login: rota.login }]);
    if (!layout?.composer) throw erroRota(layout?.login ? 'login_necessario' : 'layout_incompativel', layout?.login ? 'a rota exige login' : 'composer não encontrado; use o modo manual', rota, 'layout');
    const antes = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas }]);
    const preparado = await injetar(aba.id, prepararEnvio, [{ campos: rota.campos, texto: String(texto).slice(0, 6000) }]);
    if (!preparado?.ok) throw erroRota('composer_indisponivel', preparado?.erro || 'composer indisponível', rota, 'preparar');
    await new Promise((r) => setTimeout(r, 300));
    const envio = await injetar(aba.id, acionarEnvio, [{ envio: rota.envio }]);
    if (!envio?.ok) throw erroRota('envio_falhou', envio?.erro || 'envio não confirmado', rota, 'enviar');
    const fim = Date.now() + 90000;
    let ultimo = '', estavel = 0;
    while (Date.now() < fim) {
      await new Promise((r) => setTimeout(r, 1500));
      const atual = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas }]);
      const novidades = (atual?.textos || []).filter((t) => !(antes?.textos || []).includes(t));
      const candidato = novidades.at(-1) || (atual?.total > (antes?.total || 0) ? atual.ultimo : '');
      if (!candidato) continue;
      if (candidato === ultimo) estavel++; else { ultimo = candidato; estavel = 0; }
      if (estavel >= 2 && candidato.length > 2) {
        await registrarSaude(rota, true, Date.now() - inicio);
        return { ok: true, texto: candidato, via: 'extensao:' + rota.id, versaoAdaptador: rota.versao };
      }
    }
    throw erroRota('resposta_timeout', 'a rota não devolveu uma resposta estável em 90 segundos', rota, 'resposta');
  } catch (erro) {
    await registrarSaude(rota, false, Date.now() - inicio, erro.message);
    throw erro;
  }
}
async function capturarManual({ rotaId }) {
  const rota = await obterRota(rotaId);
  if (!rota) throw erroRota('rota_inexistente', 'rota não suportada pela extensão', null, 'validar');
  await exigirAcessoInicial(rota);
  const aba = await abrirAba(rota);
  const r = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas }]);
  if (!r?.ultimo) throw erroRota('resposta_vazia', 'nenhuma resposta encontrada; envie manualmente na aba', rota, 'capturar');
  await registrarSaude(rota, true, 0);
  return { ok: true, texto: r.ultimo, via: 'extensao-manual:' + rota.id, versaoAdaptador: rota.versao };
}
async function salvarDescoberta(relatorio) {
  if (!relatorio) throw erroRota('mapeamento_falhou', 'não foi possível ler o DOM da página', null, 'mapear');
  const item = { ...relatorio, id: 'desc_' + Date.now().toString(36), t: Date.now() };
  const atuais = (await chrome.storage.local.get(CHAVE_DESCOBERTAS))[CHAVE_DESCOBERTAS] || [];
  await chrome.storage.local.set({ [CHAVE_DESCOBERTAS]: [...atuais, item].slice(-30) });
  return item;
}
async function descobrirRota(url) {
  let destino;
  try { destino = new URL(url); } catch { throw erroRota('url_invalida', 'URL inválida', null, 'validar'); }
  if (!/^https?:$/.test(destino.protocol) || destino.username || destino.password || destino.href.length > 2048) throw erroRota('url_invalida', 'use uma URL http/https curta e sem credenciais', null, 'validar');
  const conhecida = [...ROTAS, ...CATALOGO_CHATS].find((r) => r.origem === destino.origin);
  if (!conhecida) throw erroRota('origem_nao_suportada', 'esta origem não está no catálogo; use “Rastrear aba atual” para mapear sem acesso permanente', conhecida, 'validar');
  if (!(await origemPermitida(destino.origin))) throw erroRota('permissao_necessaria', 'permissão necessária para ' + destino.origin + '; autorize no painel da extensão', conhecida, 'permissao');
  const aba = await abrirAba({ url: destino.href, origem: destino.origin });
  await new Promise((r) => setTimeout(r, 800));
  return salvarDescoberta(await injetar(aba.id, mapearPagina));
}
async function descobrirAbaAtual() {
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id || !/^https?:$/.test(aba.url || '')) throw erroRota('aba_invalida', 'abra uma página http/https e clique no ícone da extensão antes de rastrear', null, 'validar');
  await new Promise((r) => setTimeout(r, 500));
  let relatorio;
  try { relatorio = await injetar(aba.id, mapearPagina); }
  catch { throw erroRota('permissao_temporaria', 'o navegador não liberou esta aba; clique no ícone da extensão com a aba ativa e tente novamente', null, 'permissao'); }
  return salvarDescoberta(relatorio);
}
async function ativarDescoberta(id, seletores = {}) {
  const atuais = (await chrome.storage.local.get(CHAVE_DESCOBERTAS))[CHAVE_DESCOBERTAS] || [];
  const relatorio = atuais.find((r) => r.id === id);
  if (!relatorio) throw erroRota('descoberta_inexistente', 'descoberta não encontrada', null, 'validar');
  let adaptador;
  try { adaptador = criarAdaptador(relatorio, '', seletores); }
  catch (erro) { throw erroRota('descoberta_invalida', erro.message, null, 'validar'); }
  const rotas = await adaptadoresDescobertos();
  await chrome.storage.local.set({ [CHAVE_ADAPTADORES]: [...rotas.filter((r) => r.id !== adaptador.id), adaptador] });
  return { ok: true, adaptador };
}
async function abrirVM(tabId) {
  if (!tabId) throw new Error('abra o Myn em uma aba antes de abrir a VM');
  await chrome.sidePanel.open({ tabId });
  return { ok: true };
}
chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
  (async () => {
    if (!SITE_PERMITIDO.test(mensagem?.origemPagina || '')) throw new Error('origem não autorizada');
    if (mensagem.tipo === 'ping') return { ok: true, versao: chrome.runtime.getManifest().version, versaoAdaptadores: VERSAO_ADAPTADORES, rotas: (await listarRotas()).map((r) => r.id) };
    if (mensagem.tipo === 'abrir_vm') return abrirVM(remetente.tab?.id);
    if (mensagem.tipo === 'listar_rotas') return { ok: true, versaoAdaptadores: VERSAO_ADAPTADORES, rotas: await listarRotas() };
    if (mensagem.tipo === 'diagnosticar_rota') return diagnosticar(mensagem.rotaId);
    if (mensagem.tipo === 'executar_rota') return executarRota(mensagem);
    if (mensagem.tipo === 'capturar_manual') return capturarManual(mensagem);
    if (mensagem.tipo === 'descobrir_rota') return descobrirRota(mensagem.url);
    if (mensagem.tipo === 'descobrir_aba_atual') return descobrirAbaAtual();
    if (mensagem.tipo === 'ativar_descoberta') return ativarDescoberta(mensagem.descobertaId, mensagem.seletores);
    throw new Error('operação desconhecida');
  })().then(responder).catch((erro) => responder({ ok: false, erro: String(erro.message).slice(0, 300), codigo: erro.codigo || 'erro_extensao', etapa: erro.etapa || 'desconhecida', rota: erro.rota, versaoAdaptador: erro.versaoAdaptador, modoManual: ['layout_incompativel', 'login_necessario'].includes(erro.codigo) }));
  return true;
});
