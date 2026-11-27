/** Teste de aceite da extensão em Chromium isolado, incluindo ponte, VM e API direta. */
import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXT = path.join(RAIZ, 'site', 'extensao');
const BASE = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const CHROME = process.env.MYN_CHROME || [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].find(existsSync) || 'chrome';
const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-extensao-'));
const perfil = path.join(dir, 'perfil');
const prints = path.join(RAIZ, 'docs', 'prints');
await mkdir(perfil, { recursive: true });
await mkdir(prints, { recursive: true });

function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); });
  });
}
async function esperar(fn, ms = 30000, intervalo = 250) {
  const fim = Date.now() + ms;
  let ultimo;
  while (Date.now() < fim) {
    try { const v = await fn(); if (v) return v; } catch (e) { ultimo = e; }
    await new Promise((r) => setTimeout(r, intervalo));
  }
  throw ultimo || new Error('timeout');
}
class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pendentes = new Map(); }
  static async conectar(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    const c = new CDP(ws);
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      const p = c.pendentes.get(m.id);
      if (p) { c.pendentes.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    };
    const encerrar = () => { for (const p of c.pendentes.values()) p.reject(new Error('conexão CDP encerrada')); c.pendentes.clear(); };
    ws.onclose = encerrar;
    ws.onerror = encerrar;
    return c;
  }
  enviar(metodo, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pendentes.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method: metodo, params })); });
  }
  async avaliar(expressao) {
    const r = await this.enviar('Runtime.evaluate', { expression: expressao, awaitPromise: true, returnByValue: true, userGesture: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description || ''));
    return r.result.value;
  }
  async foto(arquivo, largura = 1440, altura = 1000) {
    await this.enviar('Emulation.setDeviceMetricsOverride', { width: largura, height: altura, deviceScaleFactor: 1, mobile: false });
    await new Promise((r) => setTimeout(r, 300));
    const r = await this.enviar('Page.captureScreenshot', { format: 'png', fromSurface: true });
    await writeFile(arquivo, Buffer.from(r.data, 'base64'));
  }
  fechar() { this.ws.close(); }
}
async function alvo(url, porta) {
  const r = await fetch('http://127.0.0.1:' + porta + '/json/new?' + encodeURIComponent(url), { method: 'PUT' });
  if (!r.ok) throw new Error('falha ao criar alvo: ' + r.status);
  return r.json();
}

const relatorio = { base: BASE, chrome: CHROME, extensao: {}, cliente: {}, prints: [], erros: [] };
let chrome, cdp;
try {
  const site = await fetch(BASE + '/').then((r) => r.status);
  const zip = await fetch(BASE + '/extensao/myn-recicla-extensao.zip').then((r) => ({ status: r.status, tipo: r.headers.get('content-type'), bytes: Number(r.headers.get('content-length') || 0) }));
  relatorio.site = site; relatorio.zip = zip;

  const porta = await portaLivre();
  chrome = spawn(CHROME, [
    '--user-data-dir=' + perfil, '--remote-debugging-port=' + porta,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-extensions-except=' + EXT, '--load-extension=' + EXT,
    '--window-size=1440,1000', 'about:blank',
  ], { stdio: 'ignore' });
  const versao = await esperar(() => fetch('http://127.0.0.1:' + porta + '/json/version').then((r) => r.json()).catch(() => null));
  relatorio.chromeVersao = versao.Browser;

  const paginaExtensoes = await alvo('chrome://extensions', porta);
  const ce = await CDP.conectar(paginaExtensoes.webSocketDebuggerUrl);
  await ce.enviar('Runtime.enable');
  await esperar(() => ce.avaliar('Boolean(chrome.developerPrivate)'), 30000);
  const infos = await ce.avaliar('chrome.developerPrivate.getExtensionsInfo()');
  const minha = infos.find((i) => i.name?.startsWith('Myn Recicla/01'));
  relatorio.extensao.registro = minha ? { id: minha.id, name: minha.name, state: minha.state, location: minha.location, version: minha.version, manifestErrors: minha.manifestErrors, runtimeErrors: minha.runtimeErrors, installWarnings: minha.installWarnings } : infos.map((i) => ({ id: i.id, name: i.name, state: i.state, location: i.location }));
  if (!minha) throw new Error('extensão Myn não consta em chrome://extensions');
  if (minha.state !== 'ENABLED') throw new Error('extensão Myn estado ' + minha.state + ': ' + JSON.stringify(minha));
  const idExt = minha.id;
  relatorio.extensao.id = idExt;

  relatorio.extensao.manifest = JSON.parse(await readFile(path.join(EXT, 'manifest.json'), 'utf8'));
  relatorio.extensao.sidePanel = relatorio.extensao.manifest.side_panel?.default_path || null;
  relatorio.extensao.serviceWorker = relatorio.extensao.manifest.background?.service_worker || null;

  const pagina = await alvo(BASE + '/playground.html?extensao=1&vm=1', porta);
  cdp = await CDP.conectar(pagina.webSocketDebuggerUrl);
  await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable');
  await esperar(() => cdp.avaliar('Boolean(window.myn?.cliente)'), 30000);
  relatorio.cliente.injecao = await cdp.avaliar("({dataset:document.documentElement.dataset.mynExtensao||null,scripts:[...document.scripts].map(s=>s.src)})");
  relatorio.cliente.mensagens = await cdp.avaliar(`(async()=>{const logs=[];const fn=e=>logs.push({canal:e.data?.canal,tipo:e.data?.tipo,ok:e.data?.ok,origem:e.origin,mesmaJanela:e.source===window});window.addEventListener('message',fn);window.postMessage({canal:'myn-recicla-extensao',id:'debug-ponte',tipo:'ping'},location.origin);await new Promise(r=>setTimeout(r,1500));window.removeEventListener('message',fn);return logs})()`);
  relatorio.cliente.ponte = await cdp.avaliar('window.myn.cliente.extensaoDisponivel()').catch((e) => String(e.message));
  relatorio.cliente.diagnostico = await cdp.avaliar("import('/web/core/extensao.mjs').then(m=>m.diagnostico())");
  relatorio.cliente.versao = await cdp.avaliar("import('/web/core/extensao.mjs').then(m=>m.versao())").catch((e) => String(e.message));
  relatorio.cliente.rotas = await cdp.avaliar("import('/web/core/extensao.mjs').then(m=>m.listarRotas())").catch((e) => String(e.message));
  const infosDepois = await ce.avaliar('chrome.developerPrivate.getExtensionsInfo()');
  const minhaDepois = infosDepois.find((i) => i.id === idExt);
  relatorio.extensao.erros = { runtimeErrors: minhaDepois?.runtimeErrors, runtimeWarnings: minhaDepois?.runtimeWarnings, manifestErrors: minhaDepois?.manifestErrors, views: minhaDepois?.views };
  relatorio.cliente.vmAberta = await esperar(() => cdp.avaliar("document.getElementById('painelVM').classList.contains('on')"), 30000);
  relatorio.cliente.vmPronta = await esperar(() => cdp.avaliar("document.getElementById('vmSaida').textContent==='vm pronta...'"), 30000);

  if (relatorio.cliente.ponte === true) {
    relatorio.cliente.local = await cdp.avaliar(`(async()=>{const ev=[];for await(const e of window.myn.cliente.conversar({texto:'quem é você?',sessao:'teste-extensao',effort:'low'}))ev.push(e);return {via:ev.at(-1)?.via,texto:ev.map(e=>e.token||'').join(''),eventos:ev.length}})()`);
    relatorio.cliente.permissaoNegada = await cdp.avaliar(`import('/web/core/extensao.mjs').then(async m=>{try{const r=await m.executarRota('chatgpt-web','Responda apenas OK em português.');return {resultado:r}}catch(e){return {erro:String(e.message)}}})`);
    relatorio.cliente.diagnosticoLocal = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.diagnosticarRota('myn-teste-local'))`);
    relatorio.cliente.rotaLocal = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.executarRota('myn-teste-local','teste de automação'))`);
    relatorio.cliente.manualLocal = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.capturarManual('myn-teste-local'))`);
    relatorio.cliente.descobertaLocal = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.descobrirRota('${BASE}/extensao/teste.html'))`);
    try { relatorio.cliente.adaptadorLocal = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.ativarDescoberta(${JSON.stringify(relatorio.cliente.descobertaLocal?.id || '')}))`); }
    catch (e) { relatorio.cliente.erroAtivacao = String(e.message); }
    if (relatorio.cliente.adaptadorLocal?.ok) relatorio.cliente.rotaDescoberta = await cdp.avaliar(`import('/web/core/extensao.mjs').then(m=>m.executarRota(${JSON.stringify(relatorio.cliente.adaptadorLocal?.adaptador?.id || '')},'teste descoberto'))`);
    await cdp.avaliar("window.WORK.enviar('liste os chats')");
    try { relatorio.cliente.workCatalogo = await esperar(() => cdp.avaliar("[...document.querySelectorAll('#waMsgs .wa-msg.bot')].some(m=>m.textContent.includes('Perplexity')&&m.textContent.includes('Qwen'))"), 30000); }
    catch (e) { relatorio.cliente.erroWork = String(e.message); }
  }

  try {
    relatorio.cliente.pollinations = await cdp.avaliar(`(async()=>{const ev=[];for await(const e of window.myn.cliente.conversar({texto:'Responda apenas OK em português.',sessao:'teste-pollinations',rota:'pollinations-text-api',effort:'low'}))ev.push(e);return {via:ev.at(-1)?.via,texto:ev.map(e=>e.token||'').join('').slice(0,300),eventos:ev.length}})()`);
  } catch (e) { relatorio.erros.push('Pollinations: ' + e.message); }
  ce.fechar();

  const home = await alvo(BASE + '/', porta);
  const ch = await CDP.conectar(home.webSocketDebuggerUrl);
  await ch.enviar('Page.enable');
  await esperar(() => ch.avaliar("!document.getElementById('rotasChip')?.textContent.includes('carregando') && !document.getElementById('materialRotas')?.textContent.includes('carregando')"), 30000);
  await ch.foto(path.join(prints, 'extensao-home.png'));
  relatorio.prints.push('docs/prints/extensao-home.png'); ch.fechar();

  await cdp.enviar('Page.navigate', { url: BASE + '/playground.html?extensao=1&vm=1' });
  await esperar(() => cdp.avaliar('Boolean(window.myn?.cliente)'), 30000);
  await esperar(() => cdp.avaliar("document.getElementById('vmSaida').textContent==='vm pronta...'"), 30000);
  await esperar(() => cdp.avaliar("document.getElementById('msgRotas') && !document.getElementById('msgRotas').textContent.includes('carregando')"), 30000);
  await cdp.foto(path.join(prints, 'extensao-playground.png'));
  relatorio.prints.push('docs/prints/extensao-playground.png');

  const painel = await alvo('chrome-extension://' + idExt + '/painel.html?base=' + encodeURIComponent(BASE), porta);
  const cp = await CDP.conectar(painel.webSocketDebuggerUrl);
  await cp.enviar('Page.enable');
  await esperar(() => cp.avaliar("document.querySelectorAll('#rotas .rota').length>=5"), 30000);
  await esperar(() => cp.avaliar("document.getElementById('vm').src.includes('/playground.html')"), 30000);
  await esperar(() => cp.avaliar("document.querySelectorAll('#chats .chat-item').length>=20"), 30000);
  await cp.avaliar(`(()=>{const u=document.getElementById('descobertaUrl');u.value='${BASE}/extensao/teste.html';document.getElementById('rastrear').click();return true})()`);
  await esperar(() => cp.avaliar("document.getElementById('relatorioDescoberta').hidden===false"), 30000);
  relatorio.extensao.ativacaoDireta = await cp.avaliar(`(async()=>{const d=await chrome.storage.local.get('myn-descobertas-v1');const r=d['myn-descobertas-v1'].at(-1);const t=Date.now();const out=await chrome.runtime.sendMessage({tipo:'ativar_descoberta',origemPagina:'${BASE}',descobertaId:r.id,seletores:{compositor:document.getElementById('candidatoCompositor').value,envio:document.getElementById('candidatoEnvio').value,resposta:document.getElementById('candidatoResposta').value}});return {ms:Date.now()-t,ok:out.ok,id:out.adaptador?.id,erro:out.erro}})()`);
  await new Promise((r) => setTimeout(r, 2500));
  relatorio.extensao.painel = await cp.avaliar("({rotas:document.querySelectorAll('#rotas .rota').length,manuais:document.querySelectorAll('#rotas button.manual').length,chats:document.querySelectorAll('#chats .chat-item').length,descoberta:!document.getElementById('relatorioDescoberta').hidden,iframe:document.getElementById('vm').src,status:document.getElementById('status').textContent})");
  relatorio.extensao.painelPing = await cp.avaliar("chrome.runtime.sendMessage({tipo:'ping',origemPagina:'http://127.0.0.1:5188'})").catch((e) => String(e.message));
  relatorio.extensao.sidePanelAberto = await cp.avaliar(`chrome.tabs.query({url:'http://127.0.0.1:5188/*'}).then(async(ts)=>{const t=ts.find(x=>x.url.includes('/playground.html'));if(!t)return false;await chrome.sidePanel.open({tabId:t.id});return true})`).catch((e) => String(e.message));
  await cp.foto(path.join(prints, 'extensao-painel.png'), 440, 920);
  relatorio.prints.push('docs/prints/extensao-painel.png');
  await cp.foto(path.join(prints, 'extensao-descoberta.png'), 440, 1100);
  relatorio.prints.push('docs/prints/extensao-descoberta.png');
  await cp.avaliar(`chrome.storage.local.set({'myn-adaptadores-descobertos-v1':[{id:'descoberto-externo-teste',nome:'Externo temporário',url:'https://exemplo.com/',origem:'https://exemplo.com',versao:1,campos:['textarea'],envio:['button'],respostas:['pre'],descoberta:true,acesso:'activeTab'}]});location.reload()`);
  relatorio.extensao.acessoTemporario = await esperar(() => cp.avaliar(`(()=>{const r=[...document.querySelectorAll('#rotas .rota')].find(x=>x.querySelector('b')?.textContent==='Externo temporário');if(!r)return false;const b=r.querySelector('button');return b.textContent==='activeTab'&&b.disabled})()`), 30000);
  cp.fechar();
} catch (e) {
  try {
    if (ce) {
      const infos = await ce.avaliar('chrome.developerPrivate.getExtensionsInfo()');
      const ext = infos.find((i) => i.name?.startsWith('Myn Recicla/01'));
      relatorio.extensao.errosFinais = { runtimeErrors: ext?.runtimeErrors, runtimeWarnings: ext?.runtimeWarnings, manifestErrors: ext?.manifestErrors };
    }
  } catch { /* diagnóstico final indisponível */ }
  relatorio.erros.push(String(e.stack || e));
} finally {
  try { cdp?.fechar(); } catch {}
  if (chrome?.pid) { try { execFileSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} }
  await new Promise((r) => setTimeout(r, 1200));
  await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => {});
}
const aceites = [
  relatorio.cliente.ponte === true,
  relatorio.cliente.vmAberta === true,
  relatorio.cliente.vmPronta === true,
  relatorio.extensao.sidePanelAberto === true,
  relatorio.cliente.diagnosticoLocal?.layout?.composer === true,
  relatorio.cliente.rotaLocal?.ok === true,
  relatorio.cliente.manualLocal?.ok === true,
  relatorio.cliente.pollinations?.via === 'pollinations-text-api',
  relatorio.cliente.descobertaLocal?.sugestao?.confianca >= .55,
  relatorio.cliente.adaptadorLocal?.ok === true,
  relatorio.cliente.rotaDescoberta?.ok === true,
  relatorio.cliente.workCatalogo === true,
  relatorio.extensao.ativacaoDireta?.ok === true,
  relatorio.extensao.painel?.descoberta === true,
  relatorio.extensao.acessoTemporario === true,
  relatorio.extensao.painelPing?.rotas?.length === new Set(relatorio.extensao.painelPing?.rotas || []).size,
];
relatorio.aceites = { total: aceites.length, aprovados: aceites.filter(Boolean).length };
await mkdir(path.join(RAIZ, 'outputs'), { recursive: true });
await writeFile(path.join(RAIZ, 'outputs', 'extensao-teste.json'), JSON.stringify(relatorio, null, 2));
console.log(JSON.stringify(relatorio, null, 2));
if (relatorio.erros.length || aceites.some((ok) => !ok)) process.exitCode = 1;
