import { ROTAS } from './rotas.js';
import { CATALOGO_CHATS } from './catalogo-chats.js';
import { LOJAS_CONHECIDAS } from './catalogo-lojas.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const lista = $('rotas');
let rotaManual = null;
let descobertaAtual = null;
let operacaoDescoberta = 0;
let operacoesUrl = 0;
let operacoesAtual = 0;
let envioLojaEmAndamento = false;
function atualizarBotoesDescoberta() {
  $('rastrear').disabled = operacoesUrl > 0;
  $('rastrearAtual').disabled = operacoesAtual > 0;
}
function origemMyn() { return new URL($('siteBase').value).origin; }
function mensagem(tipo, dados = {}) { return chrome.runtime.sendMessage({ tipo, origemPagina: origemMyn(), ...dados }); }

function estado(texto, classe = '') {
  status.textContent = texto;
  status.className = 'status ' + classe;
}

async function carregarBase() {
  const salvo = await chrome.storage.local.get('siteBase');
  const parametro = new URLSearchParams(location.search).get('base');
  let base = parametro || salvo.siteBase || 'https://mynrecicla.com';
  if (!parametro && !salvo.siteBase) {
    try {
      const local = await fetch('http://127.0.0.1:5188/api/saude', { signal: AbortSignal.timeout(1200) });
      if (local.ok) base = 'http://127.0.0.1:5188';
    } catch { /* produção continua como padrão */ }
  }
  $('siteBase').value = base;
}

function normalizarBase(valor) {
  const u = new URL(valor);
  if (!/^https?:$/.test(u.protocol)) throw new Error('use http ou https');
  if (!(u.hostname === 'mynrecicla.com' || (u.hostname === '127.0.0.1' && u.port === '5188'))) {
    throw new Error('use mynrecicla.com ou http://127.0.0.1:5188');
  }
  return u.origin;
}

function abrirVM() {
  try {
    const base = normalizarBase($('siteBase').value.trim());
    chrome.storage.local.set({ siteBase: base });
    $('vm').src = base + '/playground.html?extensao=1&vm=1';
    estado('VM Web aberta', 'ok');
  } catch (erro) {
    estado(erro.message, 'erro');
  }
}

async function pintarRotas() {
  lista.innerHTML = '';
  let rotas = ROTAS.filter((r) => !r.oculta), saude = {};
  try {
    const d = await mensagem('listar_rotas');
    if (d.rotas?.length) rotas = d.rotas;
    saude = Object.fromEntries(rotas.map((r) => [r.id, r.saude]));
  } catch { /* painel ainda funciona sem saúde */ }
  for (const rota of rotas) {
    const permitido = await chrome.permissions.contains({ origins: [rota.origem + '/*'] });
    const temporaria = rota.descoberta && (rota.acesso === 'activeTab' || ![...ROTAS, ...CATALOGO_CHATS].some((r) => r.origem === rota.origem));
    const linha = document.createElement('div');
    linha.className = 'rota';
    linha.innerHTML = '<div><b></b><small></small></div><button type="button">' + (temporaria ? 'activeTab' : permitido ? 'autorizado' : 'autorizar') + '</button><button type="button" class="sec manual">manual</button>';
    linha.querySelector('b').textContent = rota.nome;
    const s = saude[rota.id];
    linha.querySelector('small').textContent = rota.origem.replace('https://', '') + ' · v' + rota.versao + (rota.descoberta ? ' · descoberto' : '') + (temporaria ? ' · acesso temporário' : '') + (s ? ' · saúde ' + s.score + ' · ' + s.estado : '');
    const [botao, manual] = linha.querySelectorAll('button');
    botao.className = permitido || temporaria ? 'ok' : '';
    botao.disabled = temporaria;
    botao.onclick = async () => {
      botao.disabled = true;
      try {
        const ok = permitido || await chrome.permissions.request({ origins: [rota.origem + '/*'] });
        botao.textContent = ok ? 'autorizado' : 'negado';
        botao.className = ok ? 'ok' : '';
      } catch (erro) {
        botao.textContent = 'tentar de novo';
        estado(erro.message, 'erro');
      } finally { botao.disabled = false; }
    };
    manual.onclick = async () => {
      rotaManual = rota.id; $('manual').hidden = false; $('manualInfo').textContent = rota.nome + ' · envie sua mensagem na aba e capture a resposta.';
      try {
        const d = await mensagem('diagnosticar_rota', { rotaId: rota.id });
        if (!d.ok) throw new Error(d.erro);
        estado(d.layout?.composer ? 'modo manual · aba pronta' : 'modo manual · envio manual necessário', d.layout?.composer ? '' : 'erro');
      } catch (erro) { estado(erro.message, 'erro'); }
    };
    lista.appendChild(linha);
  }
}

function pintarChats(filtro = '') {
  const alvo = $('chats');
  alvo.innerHTML = '';
  const termo = filtro.trim().toLowerCase();
  for (const chat of CATALOGO_CHATS.filter((c) => !termo || (c.nome + ' ' + c.categoria + ' ' + c.url).toLowerCase().includes(termo))) {
    const linha = document.createElement('div');
    linha.className = 'chat-item' + (/protegido|login|limitado/.test(chat.verificacao) ? ' protegido' : '');
    const info = document.createElement('div');
    const nome = document.createElement('b'); nome.textContent = chat.nome;
    const estadoChat = document.createElement('small'); estadoChat.textContent = chat.categoria + ' · ' + chat.verificacao;
    info.append(nome, estadoChat);
    const botao = document.createElement('button'); botao.type = 'button'; botao.textContent = 'mapear';
    botao.onclick = async () => {
      botao.disabled = true;
      try {
        $('descobertaUrl').value = chat.url;
        await autorizarOrigem(chat.url);
        await rastrearUrl(chat.url);
      } catch (erro) { estado(erro.message, 'erro'); }
      finally { botao.disabled = false; }
    };
    linha.append(info, botao);
    alvo.appendChild(linha);
  }
}

async function autorizarOrigem(valor) {
  const origem = new URL(valor).origin;
  const conhecida = [...ROTAS, ...CATALOGO_CHATS].find((r) => r.origem === origem);
  if (!conhecida) throw new Error('origem fora do catálogo; use “ABA ATUAL” para rastreio temporário');
  if (await chrome.permissions.contains({ origins: [origem + '/*'] })) return true;
  const ok = await chrome.permissions.request({ origins: [origem + '/*'] });
  if (!ok) throw new Error('permissão negada para ' + origem);
  return true;
}

function preencherCandidatos(select, candidatos) {
  select.innerHTML = '';
  for (const c of candidatos || []) {
    const option = document.createElement('option');
    option.value = c.seletor;
    option.textContent = Math.round(c.pontos * 100) + '% · ' + c.seletor;
    select.appendChild(option);
  }
}

function mostrarDescoberta(r) {
  descobertaAtual = r;
  $('relatorioDescoberta').hidden = false;
  $('descobertaTitulo').textContent = r.titulo || r.origem;
  $('descobertaInfo').textContent = 'confiança ' + Math.round((r.sugestao?.confianca || 0) * 100) + '% · ' + r.origem + (r.bloqueio ? ' · bloqueio: ' + r.bloqueio : '');
  preencherCandidatos($('candidatoCompositor'), r.candidatos?.compositores);
  preencherCandidatos($('candidatoEnvio'), r.candidatos?.envios);
  preencherCandidatos($('candidatoResposta'), r.candidatos?.respostas);
  $('descobertaDetalhe').textContent = JSON.stringify({ sugestao: r.sugestao, elementos: r.elementos, bloqueio: r.bloqueio }, null, 2);
  $('ativarDescoberta').disabled = !r.sugestao?.compositor || !r.sugestao?.envio || !r.sugestao?.resposta || Boolean(r.bloqueio);
  estado(r.bloqueio ? 'bloqueio detectado · nenhum contorno' : 'mapeamento concluído · revise e ative', r.bloqueio ? 'erro' : 'ok');
}

async function rastrearUrl(url) {
  const operacao = ++operacaoDescoberta;
  operacoesUrl++; atualizarBotoesDescoberta();
  try {
    const d = await mensagem('descobrir_rota', { url });
    if (operacao !== operacaoDescoberta) return;
    if (d.ok === false) throw new Error(d.erro);
    mostrarDescoberta(d);
  } finally { operacoesUrl--; atualizarBotoesDescoberta(); }
}

async function carregarLojas() {
  try {
    const [d, e] = await Promise.all([mensagem('listar_lojas'), mensagem('listar_eventos_loja')]);
    const select = $('lojaSelect'); select.innerHTML = '';
    const vazia = document.createElement('option'); vazia.value = ''; vazia.textContent = 'nenhuma loja mapeada'; select.appendChild(vazia);
    for (const loja of d.lojas || []) { const o = document.createElement('option'); o.value = loja.id; o.textContent = loja.nome + ' · ' + Math.round(loja.confianca * 100) + '%'; select.appendChild(o); }
    $('lojaEventos').textContent = (e.eventos || []).slice(-12).reverse().map((ev) => ev.tipo + ' · ' + (ev.termo || ev.titulo || ev.origem) + '\n' + ev.produtos?.slice(0, 4).map((p) => '- ' + p.titulo + ' ' + p.preco).join('\n')).join('\n\n') || 'nenhum evento registrado.';
  } catch { /* seção continua disponível */ }
}
async function autorizarLoja(url) {
  const origem = new URL(url).origin;
  const conhecida = LOJAS_CONHECIDAS.find((l) => l.origem === origem);
  if (!conhecida) throw new Error('use “ABA ATUAL” para mapear uma loja fora do catálogo');
  if (await chrome.permissions.contains({ origins: [origem + '/*'] })) return;
  if (!await chrome.permissions.request({ origins: [origem + '/*'] })) throw new Error('permissão negada para ' + origem);
}
async function mapearLojaUrl(url) {
  const d = await mensagem('mapear_loja', { url });
  if (d.ok === false) throw new Error(d.erro);
  $('lojaSaida').textContent = JSON.stringify(d, null, 2);
  estado('loja mapeada · ' + d.nome, 'ok');
  await carregarLojas();
}
$('mapearLoja').onclick = async () => {
  try { const url = new URL($('lojaUrl').value.trim()).href; await autorizarLoja(url); await mapearLojaUrl(url); }
  catch (erro) { estado(erro.message, 'erro'); }
};
$('mapearLojaAtual').onclick = async () => {
  try { const d = await mensagem('mapear_loja_atual'); if (d.ok === false) throw new Error(d.erro); $('lojaSaida').textContent = JSON.stringify(d, null, 2); await carregarLojas(); estado('loja atual mapeada', 'ok'); }
  catch (erro) { estado(erro.message, 'erro'); }
};
$('pesquisarLoja').onclick = async () => {
  const id = $('lojaSelect').value;
  if (!id) return estado('escolha uma loja mapeada', 'erro');
  try { const d = await mensagem('pesquisar_loja', { lojaId: id, termo: $('lojaTermo').value }); if (d.ok === false) throw new Error(d.erro); $('lojaSaida').textContent = JSON.stringify({ pedido: d.pedido, matches: d.matches, produtos: d.produtos }, null, 2); await carregarLojas(); estado('pesquisa concluída · ' + d.matches.length + ' resultado(s)', 'ok'); }
  catch (erro) { estado(erro.message, 'erro'); }
};
$('observarLoja').onclick = async () => {
  const id = $('lojaSelect').value;
  if (!id) return estado('escolha uma loja mapeada', 'erro');
  try { const d = await mensagem('observar_loja', { lojaId: id }); if (d.ok === false) throw new Error(d.erro); $('lojaSaida').textContent = JSON.stringify(d, null, 2); await carregarLojas(); estado('página observada', 'ok'); }
  catch (erro) { estado(erro.message, 'erro'); }
};

$('abrirChatLoja').onclick = async () => {
  const id = $('lojaSelect').value;
  if (!id) return estado('escolha uma loja mapeada', 'erro');
  try { const d = await mensagem('abrir_chat_loja', { lojaId: id }); if (d.ok === false) throw new Error(d.erro); $('lojaSaida').textContent = JSON.stringify(d.chat, null, 2); await carregarLojas(); estado('chat da loja aberto e mapeado', 'ok'); }
  catch (erro) { estado(erro.message, 'erro'); }
};
$('enviarChatLoja').onclick = async () => {
  const id = $('lojaSelect').value;
  const texto = $('lojaPrompt').value.trim();
  if (!id) return estado('escolha uma loja mapeada', 'erro');
  if (!texto) return estado('escreva a mensagem de teste', 'erro');
  if (envioLojaEmAndamento) return;
  const loja = $('lojaSelect').selectedOptions[0]?.textContent || id;
  if (!window.confirm('Enviar esta mensagem real para ' + loja + '?\n\n' + texto.slice(0, 500))) return estado('envio cancelado; nenhuma mensagem foi enviada');
  envioLojaEmAndamento = true; $('enviarChatLoja').disabled = true;
  try { const d = await mensagem('enviar_chat_loja', { lojaId: id, texto, confirmar: true }); if (d.ok === false) throw new Error(d.erro); $('lojaSaida').textContent = d.texto || 'chat enviado'; await carregarLojas(); estado('resposta nova confirmada no chat', 'ok'); }
  catch (erro) { estado(erro.message, 'erro'); }
  finally { envioLojaEmAndamento = false; $('enviarChatLoja').disabled = false; }
};

$('abrirVm').onclick = abrirVM;
$('usarLocal').onclick = () => { $('siteBase').value = 'http://127.0.0.1:5188'; abrirVM(); };
$('siteBase').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirVM(); });
$('capturar').onclick = async () => {
  if (!rotaManual) return;
  try {
    const d = await mensagem('capturar_manual', { rotaId: rotaManual });
    if (!d.ok) throw new Error(d.erro);
    $('respostaManual').textContent = d.texto; estado('resposta capturada', 'ok');
  } catch (erro) { $('respostaManual').textContent = erro.message; estado(erro.message, 'erro'); }
};
$('diagnosticar').onclick = async () => {
  if (!rotaManual) return;
  try {
    const d = await mensagem('diagnosticar_rota', { rotaId: rotaManual });
    if (!d.ok) throw new Error(d.erro);
    $('respostaManual').textContent = JSON.stringify(d, null, 2); estado('diagnóstico concluído', 'ok');
  } catch (erro) { $('respostaManual').textContent = erro.message; estado(erro.message, 'erro'); }
};
$('rastrear').onclick = async () => {
  try {
    const url = new URL($('descobertaUrl').value.trim()).href;
    await autorizarOrigem(url);
    await rastrearUrl(url);
  } catch (erro) { estado(erro.message, 'erro'); }
};
$('rastrearAtual').onclick = async () => {
  const operacao = ++operacaoDescoberta;
  operacoesAtual++; atualizarBotoesDescoberta();
  try {
    const d = await mensagem('descobrir_aba_atual');
    if (operacao !== operacaoDescoberta) return;
    if (d.ok === false) throw new Error(d.erro);
    mostrarDescoberta(d);
  } catch (erro) { if (operacao === operacaoDescoberta) estado(erro.message, 'erro'); }
  finally { operacoesAtual--; atualizarBotoesDescoberta(); }
};
$('chatBusca').addEventListener('input', (e) => pintarChats(e.target.value));
$('ativarDescoberta').onclick = async () => {
  if (!descobertaAtual?.id) return;
  $('ativarDescoberta').disabled = true;
  try {
    const d = await mensagem('ativar_descoberta', { descobertaId: descobertaAtual.id, seletores: {
      compositor: $('candidatoCompositor').value,
      envio: $('candidatoEnvio').value,
      resposta: $('candidatoResposta').value,
    } });
    if (!d.ok) throw new Error(d.erro);
    estado('adaptador ativado · ' + d.adaptador.nome, 'ok');
    await pintarRotas();
  } catch (erro) { estado(erro.message, 'erro'); }
  finally { $('ativarDescoberta').disabled = false; }
};
$('limparDescoberta').onclick = () => { descobertaAtual = null; $('relatorioDescoberta').hidden = true; estado('descoberta limpa'); };

carregarBase().then(abrirVM).catch((erro) => estado(erro.message, 'erro'));
pintarRotas().catch((erro) => estado(erro.message, 'erro'));
pintarChats();
carregarLojas();
