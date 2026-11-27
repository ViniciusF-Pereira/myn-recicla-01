import { ROTAS } from './rotas.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const lista = $('rotas');

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
  for (const rota of ROTAS.filter((r) => !r.oculta)) {
    const permitido = await chrome.permissions.contains({ origins: [rota.origem + '/*'] });
    const linha = document.createElement('div');
    linha.className = 'rota';
    linha.innerHTML = '<div><b></b><small></small></div><button type="button">' + (permitido ? 'autorizado' : 'autorizar') + '</button>';
    linha.querySelector('b').textContent = rota.nome;
    linha.querySelector('small').textContent = rota.origem.replace('https://', '');
    const botao = linha.querySelector('button');
    botao.className = permitido ? 'ok' : '';
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
    lista.appendChild(linha);
  }
}

$('abrirVm').onclick = abrirVM;
$('usarLocal').onclick = () => { $('siteBase').value = 'http://127.0.0.1:5188'; abrirVM(); };
$('siteBase').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirVM(); });

carregarBase().then(abrirVM).catch((erro) => estado(erro.message, 'erro'));
pintarRotas().catch((erro) => estado(erro.message, 'erro'));
