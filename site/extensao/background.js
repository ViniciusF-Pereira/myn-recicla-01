import { ROTAS, VERSAO_ADAPTADORES, rotaPorId } from './rotas.js';
import { CATALOGO_CHATS } from './catalogo-chats.js';
import { LOJAS_CONHECIDAS } from './catalogo-lojas.js';
import { registrarResultado, pontuar } from './saude.mjs';
import { mapearPagina, criarAdaptador } from './descoberta.mjs';
import { mapearPaginaLoja, observarPaginaLoja, preencherBuscaLoja, acionarBuscaLoja, criarAdaptadorLoja, interpretarPedidoLoja, parseValorMonetario, produtoCorresponde, abrirEntradaChat, mapearChatLoja, prepararChatLoja, acionarChatLoja, lerRespostaChat } from './lojas.mjs';

const SITE_PERMITIDO = /^https:\/\/mynrecicla\.com$|^http:\/\/127\.0\.0\.1:5188$/;
const CHAVE_SAUDE = 'myn-saude-rotas-v1';
const CHAVE_DESCOBERTAS = 'myn-descobertas-v1';
const CHAVE_ADAPTADORES = 'myn-adaptadores-descobertos-v1';
const CHAVE_LOJAS = 'myn-lojas-descobertas-v1';
const CHAVE_EVENTOS_LOJA = 'myn-loja-eventos-v1';
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
async function esperarCancelavel(ms, operacaoId) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    verificarCancelamento(operacaoId);
    await new Promise((r) => setTimeout(r, Math.min(200, fim - Date.now())));
  }
  verificarCancelamento(operacaoId);
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
async function lojasDescobertas() {
  return (await chrome.storage.local.get(CHAVE_LOJAS))[CHAVE_LOJAS] || [];
}
async function obterLoja(id) {
  return (await lojasDescobertas()).find((l) => l.id === id) || null;
}
async function listarLojas() {
  return (await lojasDescobertas()).map((l) => l.acesso === 'activeTab' ? (({ url, ...resto }) => resto)(l) : l);
}
function hashLocal(valor) {
  let h = 2166136261;
  for (const c of String(valor || '')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function eventoLojaSeguro(evento = {}) {
  const saida = {
    id: evento.id || 'ev_' + crypto.randomUUID(), tipo: String(evento.tipo || 'observacao').slice(0, 40),
    loja: String(evento.loja || '').slice(0, 120), origem: String(evento.origem || '').slice(0, 300),
    titulo: String(evento.titulo || '').slice(0, 240), url: String(evento.url || '').split(/[?#]/)[0].slice(0, 1000),
    t: Number(evento.t) || Date.now(), produtoAtual: Boolean(evento.produtoAtual),
    produtosContagem: Array.isArray(evento.produtos) ? evento.produtos.length : 0,
  };
  if (evento.categoria) saida.categoria = String(evento.categoria).slice(0, 60);
  if (evento.termo) saida.termoHash = hashLocal(evento.termo);
  if (evento.termoHash) saida.termoHash = String(evento.termoHash).slice(0, 40);
  if (evento.texto) { saida.textoChars = String(evento.texto).length; saida.textoHash = hashLocal(evento.texto); }
  if (evento.textoHash) { saida.textoHash = String(evento.textoHash).slice(0, 40); saida.textoChars = Number(evento.textoChars) || 0; }
  if (evento.resposta) { saida.respostaChars = String(evento.resposta).length; saida.respostaHash = hashLocal(evento.resposta); }
  if (evento.respostaHash) { saida.respostaHash = String(evento.respostaHash).slice(0, 40); saida.respostaChars = Number(evento.respostaChars) || 0; }
  return saida;
}
function eventosRecentes(eventos = []) {
  const limite = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return eventos.filter((e) => (Number(e.t) || 0) >= limite).map(eventoLojaSeguro).slice(-200);
}
async function registrarEventoLoja(evento) {
  return serializar(async () => {
    const atuais = (await chrome.storage.local.get(CHAVE_EVENTOS_LOJA))[CHAVE_EVENTOS_LOJA] || [];
    await chrome.storage.local.set({ [CHAVE_EVENTOS_LOJA]: eventosRecentes([...atuais, eventoLojaSeguro(evento)]) });
  });
}
async function salvarLoja(relatorio, nome = '') {
  return serializar(async () => {
    const conhecida = LOJAS_CONHECIDAS.find((l) => l.origem === relatorio.origem);
    const adaptador = criarAdaptadorLoja(relatorio, nome || conhecida?.nome);
    adaptador.acesso = conhecida ? 'opcional' : 'activeTab';
    const atuais = await lojasDescobertas();
    await chrome.storage.local.set({ [CHAVE_LOJAS]: [...atuais.filter((l) => l.origem !== adaptador.origem), adaptador] });
    return adaptador;
  });
}
async function mapearLoja(url, operacaoId) {
  verificarCancelamento(operacaoId);
  let destino;
  try { destino = new URL(url); } catch { throw erroRota('url_invalida', 'URL inválida', null, 'validar'); }
  if (!/^https?:$/.test(destino.protocol) || destino.username || destino.password || destino.href.length > 2048) throw erroRota('url_invalida', 'use uma URL http/https válida', null, 'validar');
  const conhecida = LOJAS_CONHECIDAS.find((l) => l.origem === destino.origin);
  if (!conhecida) throw erroRota('loja_nao_suportada', 'loja fora do catálogo; use “mapear loja atual”', null, 'validar');
  if (!(await origemPermitida(destino.origin))) throw erroRota('permissao_necessaria', 'permissão necessária para ' + destino.origin, conhecida, 'permissao');
  const aba = await abrirAba({ url: destino.href, origem: destino.origin });
  await esperarCancelavel(900, operacaoId);
  const relatorio = await injetar(aba.id, mapearPaginaLoja);
  return salvarLoja(relatorio, conhecida.nome);
}
async function mapearLojaAtual(operacaoId) {
  verificarCancelamento(operacaoId);
  const [aba] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!aba?.id || !/^https?:$/.test(aba.url || '')) throw erroRota('aba_invalida', 'abra uma loja e clique no ícone da extensão', null, 'validar');
  await esperarCancelavel(700, operacaoId);
  let relatorio;
  try { relatorio = await injetar(aba.id, mapearPaginaLoja); }
  catch { throw erroRota('permissao_temporaria', 'o navegador não liberou esta aba; clique no ícone da extensão com a aba ativa', null, 'permissao'); }
  return salvarLoja(relatorio);
}
async function observarLoja(id, operacaoId) {
  verificarCancelamento(operacaoId);
  const loja = await obterLoja(id);
  if (!loja) throw erroRota('loja_inexistente', 'loja não mapeada', null, 'validar');
  await exigirAcessoInicial(loja);
  const aba = await abrirAba(loja);
  const evento = await injetar(aba.id, observarPaginaLoja, [{ adaptador: loja }]);
  await registrarEventoLoja({ tipo: 'observacao', loja: loja.id, ...evento });
  return evento;
}
const assinaturaProdutos = (evento) => JSON.stringify((evento?.produtos || []).map((p) => [p.titulo, p.preco, p.visivel]));
async function pesquisarLoja({ id, termo, operacaoId }) {
  verificarCancelamento(operacaoId);
  const loja = await obterLoja(id);
  if (!loja) throw erroRota('loja_inexistente', 'loja não mapeada', null, 'validar');
  if (!String(termo || '').trim()) throw erroRota('termo_invalido', 'informe o que pesquisar', null, 'validar');
  const pedido = interpretarPedidoLoja(termo);
  await exigirAcessoInicial(loja);
  const aba = await abrirAba(loja);
  const antes = await injetar(aba.id, observarPaginaLoja, [{ adaptador: loja }]);
  const antesAssinatura = assinaturaProdutos(antes);
  const antesUrl = (await chrome.tabs.get(aba.id)).url || '';
  const preparado = await injetar(aba.id, preencherBuscaLoja, [{ busca: loja.busca, termo: pedido.termo }]);
  if (!preparado?.ok) throw erroRota('busca_falhou', preparado?.erro || 'busca indisponível', loja, 'buscar');
  await esperarCancelavel(200, operacaoId);
  const acao = await injetar(aba.id, acionarBuscaLoja, [{ busca: loja.busca }]);
  if (!acao?.ok) throw erroRota('busca_falhou', acao?.erro || 'não foi possível pesquisar', loja, 'buscar');
  let evento = antes, mudou = false;
  for (let i = 0; i < 32; i++) {
    await esperarCancelavel(250, operacaoId);
    evento = await injetar(aba.id, observarPaginaLoja, [{ adaptador: loja }]);
    const urlAtual = (await chrome.tabs.get(aba.id)).url || '';
    if (urlAtual !== antesUrl || assinaturaProdutos(evento) !== antesAssinatura) { mudou = true; break; }
  }
  if (!mudou) {
    const urlAtual = new URL((await chrome.tabs.get(aba.id)).url || loja.url);
    const jaPesquisado = normalizarBusca(urlAtual.searchParams.get('q') || '') === normalizarBusca(pedido.termo);
    if (!jaPesquisado) throw erroRota('busca_sem_mudanca', 'a busca não alterou a página; revise o mapeamento', loja, 'buscar');
  }
  const matches = evento.produtos.filter((p) => p.visivel !== false && produtoCorresponde(p.titulo, pedido.termo) && (!pedido.budget || (parseValorMonetario(p.preco) !== null && parseValorMonetario(p.preco) <= pedido.budget)));
  const resultado = { ...evento, pedido, matches };
  await registrarEventoLoja({ tipo: 'pesquisa', loja: loja.id, termo: pedido.termo, categoria: pedido.categoria, ...evento });
  return resultado;
}
function normalizarBusca(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }
async function listarEventosLoja() {
  const eventos = (await chrome.storage.local.get(CHAVE_EVENTOS_LOJA))[CHAVE_EVENTOS_LOJA] || [];
  const recentes = eventosRecentes(eventos);
  if (recentes.length !== eventos.length) await chrome.storage.local.set({ [CHAVE_EVENTOS_LOJA]: recentes });
  return recentes;
}
async function abrirChatLoja(id, operacaoId) {
  verificarCancelamento(operacaoId);
  const loja = await obterLoja(id);
  if (!loja) throw erroRota('loja_inexistente', 'loja não mapeada', null, 'validar');
  if (!loja.chat?.entradas?.length) throw erroRota('chat_nao_encontrado', 'nenhuma entrada de chat foi descoberta', loja, 'chat');
  await exigirAcessoInicial(loja);
  const aba = await abrirAba(loja);
  const abertura = await injetar(aba.id, abrirEntradaChat, [{ chat: loja.chat }]);
  if (!abertura?.ok) throw erroRota('chat_nao_encontrado', abertura?.erro || 'não foi possível abrir o chat', loja, 'chat');
  await esperarCancelavel(1200, operacaoId);
  const campos = await injetar(aba.id, mapearChatLoja);
  if (!campos?.campo || !campos?.envio || !campos?.resposta) throw erroRota('chat_layout_incompativel', 'chat aberto, mas campo/envio/resposta não foram identificados', loja, 'chat');
  const atualizado = { ...loja, chat: { ...loja.chat, campos } };
  await serializar(async () => {
    const atuais = await lojasDescobertas();
    await chrome.storage.local.set({ [CHAVE_LOJAS]: atuais.map((l) => l.id === loja.id ? atualizado : l) });
  });
  return atualizado;
}
const enviosChat = new Map();
function enviarChatLoja({ id, texto, confirmar, operacaoId }) {
  const chave = String(id) + '|' + String(texto || '').slice(0, 2000);
  const existente = enviosChat.get(chave);
  if (existente) return existente;
  const execucao = executarEnvioChatLoja({ id, texto, confirmar, operacaoId }).finally(() => enviosChat.delete(chave));
  enviosChat.set(chave, execucao);
  return execucao;
}
async function executarEnvioChatLoja({ id, texto, confirmar, operacaoId }) {
  verificarCancelamento(operacaoId);
  if (confirmar !== true) throw erroRota('confirmacao_necessaria', 'confirme o envio da mensagem para o chat da loja', null, 'confirmar');
  if (!String(texto || '').trim()) throw erroRota('texto_invalido', 'escreva a mensagem de teste', null, 'validar');
  const loja = await abrirChatLoja(id, operacaoId);
  await exigirAcessoInicial(loja);
  const aba = await abrirAba(loja);
  const antes = await injetar(aba.id, lerRespostaChat, [{ resposta: loja.chat.campos.resposta }]);
  if (!antes?.encontrado) throw erroRota('chat_layout_incompativel', 'não foi possível isolar a resposta do chat', loja, 'chat');
  const preparado = await injetar(aba.id, prepararChatLoja, [{ campo: loja.chat.campos.campo, texto: String(texto).slice(0, 2000) }]);
  if (!preparado?.ok) throw erroRota('chat_envio_falhou', preparado?.erro || 'campo indisponível', loja, 'chat');
  await esperarCancelavel(200, operacaoId);
  verificarCancelamento(operacaoId);
  const envio = await injetar(aba.id, acionarChatLoja, [{ campo: loja.chat.campos.campo, envio: loja.chat.campos.envio }]);
  if (!envio?.ok) throw erroRota('chat_envio_falhou', envio?.erro || 'envio não confirmado', loja, 'chat');
  let resposta = antes;
  for (let i = 0; i < 32; i++) {
    await esperarCancelavel(250, operacaoId);
    resposta = await injetar(aba.id, lerRespostaChat, [{ resposta: loja.chat.campos.resposta }]);
    if (resposta?.encontrado && resposta.texto && resposta.texto !== antes.texto) break;
  }
  if (!resposta?.encontrado || !resposta.texto || resposta.texto === antes.texto) throw erroRota('chat_sem_resposta', 'o clique não produziu uma resposta nova; nada foi confirmado como concluído', loja, 'chat');
  const pagina = await injetar(aba.id, observarPaginaLoja, [{ adaptador: loja }]);
  await registrarEventoLoja({ tipo: 'chat-loja', loja: loja.id, texto: String(texto).slice(0, 500), resposta: resposta.texto, ...pagina });
  return { ok: true, texto: resposta.texto, loja: loja.id };
}

async function abrirVM(tabId) {
  if (!tabId) throw new Error('abra o Myn em uma aba antes de abrir a VM');
  await chrome.sidePanel.open({ tabId });
  return { ok: true };
}
chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.status !== 'complete' || !/^https?:$/.test(tab.url || '')) return;
  (async () => {
    const origem = new URL(tab.url).origin;
    const loja = (await lojasDescobertas()).find((l) => l.origem === origem);
    if (!loja) return;
    const evento = await injetar(tabId, observarPaginaLoja, [{ adaptador: loja }]);
    await registrarEventoLoja({ tipo: 'navegacao', loja: loja.id, ...evento });
  })().catch(() => { /* aba sem acesso ou página fechada */ });
});

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
    if (mensagem.tipo === 'listar_lojas') return { ok: true, lojas: await listarLojas() };
    if (mensagem.tipo === 'mapear_loja') return mapearLoja(mensagem.url, mensagem.operacaoId);
    if (mensagem.tipo === 'mapear_loja_atual') return mapearLojaAtual(mensagem.operacaoId);
    if (mensagem.tipo === 'observar_loja') return observarLoja(mensagem.lojaId, mensagem.operacaoId);
    if (mensagem.tipo === 'pesquisar_loja') return pesquisarLoja({ id: mensagem.lojaId, termo: mensagem.termo, operacaoId: mensagem.operacaoId });
    if (mensagem.tipo === 'listar_eventos_loja') return { ok: true, eventos: await listarEventosLoja() };
    if (mensagem.tipo === 'abrir_chat_loja') return abrirChatLoja(mensagem.lojaId, mensagem.operacaoId);
    if (mensagem.tipo === 'enviar_chat_loja') return enviarChatLoja({ id: mensagem.lojaId, texto: mensagem.texto, confirmar: mensagem.confirmar, operacaoId: mensagem.operacaoId });
    throw new Error('operação desconhecida');
  })().then(responder).catch((erro) => responder({ ok: false, erro: String(erro.message).slice(0, 300), codigo: erro.codigo || 'erro_extensao', etapa: erro.etapa || 'desconhecida', rota: erro.rota, versaoAdaptador: erro.versaoAdaptador, modoManual: ['layout_incompativel', 'login_necessario'].includes(erro.codigo) }));
  return true;
});
