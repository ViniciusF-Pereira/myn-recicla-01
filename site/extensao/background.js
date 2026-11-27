import { ROTAS, VERSAO_ADAPTADORES, rotaPorId } from './rotas.js';
import { CATALOGO_CHATS } from './catalogo-chats.js';
import { registrarResultado, pontuar } from './saude.mjs';
import { mapearPagina, criarAdaptador } from './descoberta.mjs';

const SITE_PERMITIDO = /^https:\/\/mynrecicla\.com$|^http:\/\/127\.0\.0\.1:5188$/;
const CHAVE_SAUDE = 'myn-saude-rotas-v1';
const CHAVE_DESCOBERTAS = 'myn-descobertas-v1';
const CHAVE_ADAPTADORES = 'myn-adaptadores-descobertos-v1';
let saudeCache = {};
let filaMutation = Promise.resolve();
const canceladas = new Set();
function serializar(fn) {
  const resultado = filaMutation.then(fn, fn);
  filaMutation = resultado.catch(() => {});
  return resultado;
}
function verificarCancelamento(operacaoId) {
  if (operacaoId && canceladas.has(operacaoId)) throw erroRota('operacao_cancelada', 'operação cancelada', null, 'cancelar');
}
function cancelarOperacao(operacaoId) {
  if (!operacaoId) return { ok: true };
  canceladas.add(operacaoId);
  setTimeout(() => canceladas.delete(operacaoId), 120000);
  return { ok: true };
}

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
function diagnosticarLayout({ campos, respostas, login, unico = false }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const encontrar = (seletores) => {
    for (const seletor of seletores || []) {
      try {
        const els = [...document.querySelectorAll(seletor)].filter(visivel);
        if (els.length && (!unico || els.length === 1)) return els[0];
      } catch { /* seletor inválido */ }
    }
    return null;
  };
  const campo = encontrar(campos), resposta = encontrar(respostas), loginEl = encontrar(login);
  return { composer: Boolean(campo), resposta: Boolean(resposta), login: Boolean(loginEl), url: location.href, titulo: document.title };
}
function prepararEnvio({ campos, texto, unico = false }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const encontrar = (seletores) => {
    for (const seletor of seletores || []) {
      try {
        const els = [...document.querySelectorAll(seletor)].filter(visivel);
        if (els.length && (!unico || els.length === 1)) return els[0];
      } catch { /* seletor inválido */ }
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
function acionarEnvio({ envio, descoberta = false, campos = [] }) {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  let campo = descoberta ? null : document.activeElement;
  if (descoberta) {
    for (const seletor of campos) {
      try { const els = [...document.querySelectorAll(seletor)].filter(visivel); if (els.length === 1) { campo = els[0]; break; } } catch { /* continua */ }
    }
    if (!campo) return { ok: false, erro: 'composer configurado não encontrado ou não é único' };
  }
  for (const seletor of envio || []) {
    try {
      const els = [...document.querySelectorAll(seletor)].filter(visivel);
      if (els.length !== 1) continue;
      const botao = els[0];
      if (botao.disabled) continue;
      if (descoberta) {
        const alvo = ((botao.innerText || '') + ' ' + (botao.getAttribute('aria-label') || '') + ' ' + (botao.getAttribute('title') || '') + ' ' + (botao.getAttribute('data-testid') || '')).toLowerCase();
        const destrutivo = /delete|remove|destroy|excluir|apagar|limpar|clear|cancel|close|fechar|voltar|back|next|anterior/.test(alvo);
        const semantico = /send|reply|respond|ask|enviar|responder|perguntar/.test(alvo);
        if (destrutivo || !semantico || botao.type === 'reset') continue;
        const a = campo?.getBoundingClientRect(), b = botao.getBoundingClientRect();
        const perto = Boolean(a && b && Math.hypot(a.left - b.left, a.top - b.top) < 500);
        const mesmoForm = Boolean(campo?.form && botao.form === campo.form);
        if (!semantico || (!perto && !mesmoForm)) continue;
      }
      botao.click(); return { ok: true };
    } catch { /* continua */ }
  }
  if (!descoberta && campo) {
    campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    campo.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
    return { ok: true };
  }
  return { ok: false, erro: descoberta ? 'nenhum botão de envio único, semântico e próximo do composer' : 'não foi possível enviar' };
}
function lerResposta({ respostas, descoberta = false }) {
  const textos = [];
  let totalNos = 0;
  const usuario = '[data-message-author-role="user"], [data-role="user" i], [class~="user"], [class*="user-message" i], [class*="human" i]';
  const assistente = '[data-message-author-role="assistant"], [data-testid="assistant-message"], .font-claude-response, [data-role="assistant" i], [class~="assistant"], [class*="assistant-message" i], [class*="answer" i]';
  const semantico = (n) => /assistant|response|answer|resposta|prose|markdown|output|result/i.test(String(n.id || '') + ' ' + String(n.className || '') + ' ' + (n.getAttribute('role') || '') + ' ' + (n.getAttribute('data-testid') || ''));
  for (const seletor of respostas || []) {
    try {
      for (const n of document.querySelectorAll(seletor)) {
        if (n.matches(usuario) || n.closest(usuario)) continue;
        let nos;
        if (descoberta) {
          const assistentes = n.matches(assistente) ? [n] : [...n.querySelectorAll(assistente)];
          if (assistentes.length) nos = assistentes;
          else if (semantico(n) && !n.querySelector(usuario)) nos = [n];
          else continue;
        } else nos = [n];
        for (const no of nos) {
          const t = no.innerText || no.textContent || '';
          if (t.trim()) { textos.push(t.trim()); totalNos++; }
        }
      }
    } catch { /* continua */ }
  }
  const unicos = [...new Set(textos)];
  return { textos: unicos.slice(-4), ultimo: unicos.at(-1) || '', total: unicos.length, totalNos };
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
  return (await adaptadoresDescobertos()).find((r) => r.id === id) || rotaPorId(id) || null;
}
async function listarRotas() {
  const saude = await carregarSaude();
  const descobertos = await adaptadoresDescobertos();
  const porId = new Map(descobertos.map((r) => [r.id, r]));
  const rotas = ROTAS.map((r) => {
    const descoberta = porId.get(r.id);
    return descoberta ? { ...descoberta, oculta: r.oculta } : r;
  });
  for (const rota of descobertos) if (!ROTAS.some((r) => r.id === rota.id)) rotas.push(rota);
  return rotas.filter((r) => !r.oculta).map((r) => {
    const saida = { ...r, saude: pontuar(r.id, saude[r.id]) };
    if (saida.acesso === 'activeTab') delete saida.url;
    return saida;
  });
}
async function diagnosticar(rotaId) {
  const rota = await obterRota(rotaId);
  if (!rota) throw erroRota('rota_inexistente', 'rota não suportada pela extensão', null, 'validar');
  await exigirAcessoInicial(rota);
  const aba = await abrirAba(rota);
  const layout = await injetar(aba.id, diagnosticarLayout, [{ campos: rota.campos, respostas: rota.respostas, login: rota.login, unico: Boolean(rota.descoberta) }]);
  const saude = await carregarSaude();
  return { ok: true, rota: rota.id, versaoAdaptador: rota.versao, layout, saude: pontuar(rota.id, saude[rota.id]), modoManual: !layout?.composer };
}
async function executarRota({ rotaId, texto }) {
  const rota = await obterRota(rotaId), inicio = Date.now();
  if (!rota) throw erroRota('rota_inexistente', 'rota não suportada pela extensão', null, 'validar');
  try {
    await exigirAcessoInicial(rota);
    const aba = await abrirAba(rota);
    const layout = await injetar(aba.id, diagnosticarLayout, [{ campos: rota.campos, respostas: rota.respostas, login: rota.login, unico: Boolean(rota.descoberta) }]);
    if (!layout?.composer) throw erroRota(layout?.login ? 'login_necessario' : 'layout_incompativel', layout?.login ? 'a rota exige login' : 'composer não encontrado; use o modo manual', rota, 'layout');
    const antes = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas, descoberta: Boolean(rota.descoberta) }]);
    const preparado = await injetar(aba.id, prepararEnvio, [{ campos: rota.campos, texto: String(texto).slice(0, 6000), unico: Boolean(rota.descoberta) }]);
    if (!preparado?.ok) throw erroRota('composer_indisponivel', preparado?.erro || 'composer indisponível', rota, 'preparar');
    await new Promise((r) => setTimeout(r, 300));
    const envio = await injetar(aba.id, acionarEnvio, [{ envio: rota.envio, campos: rota.campos, descoberta: Boolean(rota.descoberta) }]);
    if (!envio?.ok) throw erroRota('envio_falhou', envio?.erro || 'envio não confirmado', rota, 'enviar');
    const fim = Date.now() + 90000;
    let ultimo = '', estavel = 0;
    while (Date.now() < fim) {
      await new Promise((r) => setTimeout(r, 1500));
      const atual = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas, descoberta: Boolean(rota.descoberta) }]);
      const novidades = (atual?.textos || []).filter((t) => !(antes?.textos || []).includes(t));
      const candidato = novidades.at(-1) || (atual?.totalNos > (antes?.totalNos || 0) ? atual.ultimo : '');
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
  const r = await injetar(aba.id, lerResposta, [{ respostas: rota.respostas, descoberta: Boolean(rota.descoberta) }]);
  if (!r?.ultimo) throw erroRota('resposta_vazia', 'nenhuma resposta encontrada; envie manualmente na aba', rota, 'capturar');
  await registrarSaude(rota, true, 0);
  return { ok: true, texto: r.ultimo, via: 'extensao-manual:' + rota.id, versaoAdaptador: rota.versao };
}
async function salvarDescoberta(relatorio, operacaoId) {
  if (!relatorio) throw erroRota('mapeamento_falhou', 'não foi possível ler o DOM da página', null, 'mapear');
  return serializar(async () => {
    verificarCancelamento(operacaoId);
    const conhecida = [...ROTAS, ...CATALOGO_CHATS].find((r) => r.origem === relatorio.origem);
    const sanitizada = new URL(relatorio.url); sanitizada.search = ''; sanitizada.hash = '';
    const urlOperacional = conhecida?.url || sanitizada.href;
    const url = conhecida?.url || sanitizada.origin + '/';
    const titulo = conhecida?.nome || sanitizada.hostname;
    const item = { ...relatorio, url, titulo, urlOperacional, id: 'desc_' + crypto.randomUUID(), t: Date.now() };
    const atuais = (await chrome.storage.local.get(CHAVE_DESCOBERTAS))[CHAVE_DESCOBERTAS] || [];
    await chrome.storage.local.set({ [CHAVE_DESCOBERTAS]: [...atuais, item].slice(-30) });
    const publico = { ...item }; delete publico.urlOperacional;
    return publico;
  });
}
async function descobrirRota(url, operacaoId) {
  verificarCancelamento(operacaoId);
  let destino;
  try { destino = new URL(url); } catch { throw erroRota('url_invalida', 'URL inválida', null, 'validar'); }
  if (!/^https?:$/.test(destino.protocol) || destino.username || destino.password || destino.href.length > 2048) throw erroRota('url_invalida', 'use uma URL http/https curta e sem credenciais', null, 'validar');
  const conhecida = [...ROTAS, ...CATALOGO_CHATS].find((r) => r.origem === destino.origin);
  if (!conhecida) throw erroRota('origem_nao_suportada', 'esta origem não está no catálogo; use “Rastrear aba atual” para mapear sem acesso permanente', conhecida, 'validar');
  if (!(await origemPermitida(destino.origin))) throw erroRota('permissao_necessaria', 'permissão necessária para ' + destino.origin + '; autorize no painel da extensão', conhecida, 'permissao');
  const aba = await abrirAba({ url: destino.href, origem: destino.origin });
  await new Promise((r) => setTimeout(r, 800));
  verificarCancelamento(operacaoId);
  return salvarDescoberta(await injetar(aba.id, mapearPagina), operacaoId);
}
async function descobrirAbaAtual(operacaoId) {
  verificarCancelamento(operacaoId);
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id || !/^https?:$/.test(aba.url || '')) throw erroRota('aba_invalida', 'abra uma página http/https e clique no ícone da extensão antes de rastrear', null, 'validar');
  await new Promise((r) => setTimeout(r, 500));
  verificarCancelamento(operacaoId);
  let relatorio;
  try { relatorio = await injetar(aba.id, mapearPagina); }
  catch { throw erroRota('permissao_temporaria', 'o navegador não liberou esta aba; clique no ícone da extensão com a aba ativa e tente novamente', null, 'permissao'); }
  return salvarDescoberta(relatorio, operacaoId);
}
async function ativarDescoberta(id, seletores = {}, operacaoId) {
  return serializar(async () => {
    verificarCancelamento(operacaoId);
    const atuais = (await chrome.storage.local.get(CHAVE_DESCOBERTAS))[CHAVE_DESCOBERTAS] || [];
    const relatorio = atuais.find((r) => r.id === id);
    if (!relatorio) throw erroRota('descoberta_inexistente', 'descoberta não encontrada', null, 'validar');
    let adaptador;
    try { adaptador = criarAdaptador(relatorio, '', seletores); }
    catch (erro) { throw erroRota('descoberta_invalida', erro.message, null, 'validar'); }
    const nativa = ROTAS.find((r) => r.origem === adaptador.origem);
    if (nativa) adaptador.id = nativa.id;
    adaptador.acesso = [...ROTAS, ...CATALOGO_CHATS].some((r) => r.origem === adaptador.origem) ? 'opcional' : 'activeTab';
    const rotas = await adaptadoresDescobertos();
    const anterior = rotas.find((r) => r.origem === adaptador.origem) || nativa;
    const assinatura = (r) => JSON.stringify([r.url, r.campos, r.envio, r.respostas]);
    const saude = await carregarSaude();
    const mudouSaude = Boolean(anterior && assinatura(anterior) !== assinatura(adaptador));
    if (mudouSaude) delete saude[adaptador.id];
    verificarCancelamento(operacaoId);
    if (mudouSaude) saudeCache = saude;
    const payload = { [CHAVE_ADAPTADORES]: [...rotas.filter((r) => r.origem !== adaptador.origem), adaptador] };
    if (mudouSaude) payload[CHAVE_SAUDE] = saude;
    await chrome.storage.local.set(payload);
    return { ok: true, adaptador };
  });
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
    if (mensagem.tipo === 'cancelar_operacao') return cancelarOperacao(mensagem.operacaoId);
    if (mensagem.tipo === 'descobrir_rota') return descobrirRota(mensagem.url, mensagem.operacaoId);
    if (mensagem.tipo === 'descobrir_aba_atual') return descobrirAbaAtual(mensagem.operacaoId);
    if (mensagem.tipo === 'ativar_descoberta') return ativarDescoberta(mensagem.descobertaId, mensagem.seletores, mensagem.operacaoId);
    throw new Error('operação desconhecida');
  })().then(responder).catch((erro) => responder({ ok: false, erro: String(erro.message).slice(0, 300), codigo: erro.codigo || 'erro_extensao', etapa: erro.etapa || 'desconhecida', rota: erro.rota, versaoAdaptador: erro.versaoAdaptador, modoManual: ['layout_incompativel', 'login_necessario'].includes(erro.codigo) }));
  return true;
});
