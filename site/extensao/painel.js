import { ROTAS } from './rotas.js';
import { CATALOGO_CHATS } from './catalogo-chats.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const lista = $('rotas');
let rotaManual = null;
let descobertaAtual = null;
let operacaoDescoberta = 0;
let operacoesUrl = 0;
let operacoesAtual = 0;
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
