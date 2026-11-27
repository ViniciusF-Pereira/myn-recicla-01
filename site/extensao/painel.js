import { ROTAS } from './rotas.js';

const $ = (id) => document.getElementById(id);
const status = $('status');
const lista = $('rotas');
let rotaManual = null;
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
  let saude = {};
  try { saude = Object.fromEntries(((await mensagem('listar_rotas')).rotas || []).map((r) => [r.id, r.saude])); } catch { /* painel ainda funciona sem saúde */ }
  for (const rota of ROTAS.filter((r) => !r.oculta)) {
    const permitido = await chrome.permissions.contains({ origins: [rota.origem + '/*'] });
    const linha = document.createElement('div');
    linha.className = 'rota';
    linha.innerHTML = '<div><b></b><small></small></div><button type="button">' + (permitido ? 'autorizado' : 'autorizar') + '</button><button type="button" class="sec manual">manual</button>';
    linha.querySelector('b').textContent = rota.nome;
    const s = saude[rota.id];
    linha.querySelector('small').textContent = rota.origem.replace('https://', '') + ' · v' + rota.versao + (s ? ' · saúde ' + s.score + ' · ' + s.estado : '');
    const [botao, manual] = linha.querySelectorAll('button');
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
    manual.onclick = async () => {
      rotaManual = rota.id; $('manual').hidden = false; $('manualInfo').textContent = rota.nome + ' · envie sua mensagem na aba e capture a resposta.';
      try { const d = await mensagem('diagnosticar_rota', { rotaId: rota.id }); estado(d.layout?.composer ? 'modo manual · aba pronta' : 'modo manual · envio manual necessário', !d.layout?.composer); }
      catch (erro) { estado(erro.message, true); }
    };
    lista.appendChild(linha);
  }
}

$('abrirVm').onclick = abrirVM;
$('usarLocal').onclick = () => { $('siteBase').value = 'http://127.0.0.1:5188'; abrirVM(); };
$('siteBase').addEventListener('keydown', (e) => { if (e.key === 'Enter') abrirVM(); });
$('capturar').onclick = async () => {
  if (!rotaManual) return;
  try { const d = await mensagem('capturar_manual', { rotaId: rotaManual }); $('respostaManual').textContent = d.texto || d.erro || 'sem resposta'; estado('resposta capturada', !d.ok); }
  catch (erro) { $('respostaManual').textContent = erro.message; estado(erro.message, true); }
};
$('diagnosticar').onclick = async () => {
  if (!rotaManual) return;
  try { const d = await mensagem('diagnosticar_rota', { rotaId: rotaManual }); $('respostaManual').textContent = JSON.stringify(d, null, 2); estado('diagnóstico concluído', !d.ok); }
  catch (erro) { $('respostaManual').textContent = erro.message; estado(erro.message, true); }
};

carregarBase().then(abrirVM).catch((erro) => estado(erro.message, 'erro'));
pintarRotas().catch((erro) => estado(erro.message, 'erro'));
