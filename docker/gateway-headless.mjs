/** Gateway mediado HEADLESS para a VM: Chromium sem janela, CDP local, operações nomeadas. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { writeFile, rename } from 'node:fs/promises';

const PORTA = Number(process.env.PORTA || 36877);
const DEBUG = Number(process.env.DEBUG_PORTA || 9333);
const CHROME = process.env.CHROME || '/usr/bin/chromium';
const PERFIL = process.env.PERFIL || '/tmp/myn-Recicla-chrome';
const TOKEN_FILE = process.env.MYN_GATEWAY_TOKEN_FILE || '/tmp/myn-recyla-token.txt';
const TTL = Math.max(2000, Number(process.env.TTL || 30 * 60_000));
let tokenAtual = process.env.GATEWAY_TOKEN || randomBytes(32).toString('base64url');
let tokenAnterior = '', anteriorAte = 0;
let expira = Date.now() + TTL;
async function gravarCapability() {
  const tmp = TOKEN_FILE + '.' + process.pid + '.tmp';
  await writeFile(tmp, JSON.stringify({ token: tokenAtual, expiresAt: expira }) + '\n');
  await rename(tmp, TOKEN_FILE);
}
async function renovarToken() {
  tokenAnterior = tokenAtual;
  anteriorAte = Date.now() + 30_000;
  if (!process.env.GATEWAY_TOKEN) tokenAtual = randomBytes(32).toString('base64url');
  expira = Date.now() + TTL;
  await gravarCapability();
  console.log('capability renovada; expira=' + new Date(expira).toISOString());
}
const ALLOW = new Set((process.env.ALLOW || '127.0.0.1,::1,172.17.0.1').split(','));
const DOMINIOS = /(^|\.)(chat\.z\.ai|z\.ai|huggingface\.co|openrouter\.ai|chatgpt\.com|claude\.ai|kimi\.com|chat\.mistral\.ai|mistral\.ai|chat\.deepseek\.com|grok\.com|perplexity\.ai|lmarena\.ai|duckduckgo\.com|pollinations\.ai|brave\.com|search\.brave\.com)$/i;

const filho = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu',
  '--remote-debugging-port=' + DEBUG, '--user-data-dir=' + PERFIL,
  '--no-first-run', '--no-default-browser-check', 'about:blank',
], { stdio: 'ignore', detached: true });
filho.unref();

async function esperarDebug() {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch('http://127.0.0.1:' + DEBUG + '/json/version'); if (r.ok) return await r.json(); }
    catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Chromium headless não abriu CDP');
}
const versao = await esperarDebug();
const ws = new WebSocket(versao.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
let seq = 0;
const pendentes = new Map();
ws.addEventListener('message', (evento) => {
  const msg = JSON.parse(String(evento.data));
  if (msg.id && pendentes.has(msg.id)) { pendentes.get(msg.id)(msg); pendentes.delete(msg.id); }
});
function cdp(method, params = {}, sessionId) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendentes.delete(id); reject(new Error('CDP timeout: ' + method)); }, 15000);
    pendentes.set(id, (msg) => { clearTimeout(timer); msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result ?? {}); });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
let sessao;
async function garantir() {
  if (sessao) return sessao;
  const { targetInfos = [] } = await cdp('Target.getTargets');
  const pagina = targetInfos.find((t) => t.type === 'page');
  if (!pagina) throw new Error('sem aba');
  const { sessionId } = await cdp('Target.attachToTarget', { targetId: pagina.targetId, flatten: true });
  await cdp('Page.enable', {}, sessionId);
  sessao = sessionId;
  return sessionId;
}
const json = (res, status, obj) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) });
  res.end(body);
};
const server = http.createServer(async (req, res) => {
  const remoto = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  if (!ALLOW.has(remoto)) return json(res, 403, { ok: false, error: 'ip_not_allowed' });
  const hdr = Buffer.from(String(req.headers.authorization || ''));
  const atual = Buffer.from('Bearer ' + tokenAtual);
  const anterior = tokenAnterior && Date.now() < anteriorAte ? Buffer.from('Bearer ' + tokenAnterior) : null;
  const autorizado = (atual.length === hdr.length && atual.equals(hdr))
    || (anterior && anterior.length === hdr.length && anterior.equals(hdr));
  if (Date.now() > expira || !autorizado) return json(res, 401, { ok: false, error: 'unauthorized' });
  const rota = req.url || '';
  try {
    if (rota === '/v1/browser/targets' && req.method === 'GET') {
      const { targetInfos = [] } = await cdp('Target.getTargets');
      return json(res, 200, { ok: true, targets: targetInfos.filter((t) => t.type === 'page').map((t) => ({ id: t.targetId, title: String(t.title || ''), url: String(t.url || '') })) });
    }
    let corpo = ''; for await (const p of req) corpo += p;
    const b = corpo ? JSON.parse(corpo) : {};
    const sid = await garantir();
    if (rota === '/v1/browser/navigate') {
      let u; try { u = new URL(String(b.url)); } catch { return json(res, 400, { ok: false, error: 'url_invalida' }); }
      if (u.protocol !== 'https:' && !(u.protocol === 'brave:' && u.hostname === 'leo-ai')) return json(res, 400, { ok: false, error: 'url_not_allowed' });
      if (u.protocol === 'https:' && !DOMINIOS.test(u.hostname)) return json(res, 400, { ok: false, error: 'url_not_allowed' });
      await cdp('Page.navigate', { url: b.url }, sid);
      return json(res, 200, { ok: true });
    }
    if (rota === '/v1/browser/activate') {
      sessao = undefined; await garantir();
      return json(res, 200, { ok: true });
    }
    if (rota === '/v1/browser/key') {
      const key = String(b.key || ''), code = key.length === 1 ? 'Key' + key.toUpperCase() : key;
      await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Enter' ? 13 : key.toUpperCase().charCodeAt(0) }, sid);
      await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key, code }, sid);
      return json(res, 200, { ok: true });
    }
    if (rota === '/v1/browser/type') {
      await cdp('Input.insertText', { text: String(b.text || '').slice(0, 4096) }, sid);
      return json(res, 200, { ok: true });
    }
    if (rota === '/v1/browser/click') {
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await cdp('Input.dispatchMouseEvent', { type, x: Number(b.x) || 0, y: Number(b.y) || 0, button: 'left', clickCount: 1, ...(type === 'mouseMoved' ? {} : { buttons: 1 }) }, sid);
      return json(res, 200, { ok: true });
    }
    if (rota === '/v1/browser/read' || rota === '/v1/browser/read-all') {
      const limite = Math.min(12000, Number(b.limit || 6000));
      const expr = `({title:document.title,url:location.href,text:((document.body&&document.body.innerText)||'').slice(-${limite})})`;
      const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true }, sid);
      return json(res, 200, { ok: true, ...(r.result?.value ?? {}) });
    }
    if (rota === '/v1/browser/focus-composer' || rota === '/v1/browser/focus') {
      const expr = `(() => { const el=document.querySelector('textarea,[contenteditable=true]'); if(!el) return {ok:false}; el.focus(); const r=el.getBoundingClientRect(); return {ok:true,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}; })()`;
      const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true }, sid);
      return json(res, 200, { ok: true, ...(r.result?.value ?? {}) });
    }
    if (rota === '/v1/browser/clear') {
      const r = await cdp('Runtime.evaluate', { expression: `(() => { const el=document.activeElement; if(!el) return {ok:false}; if(el.isContentEditable) el.textContent=''; else if('value' in el) el.value=''; el.dispatchEvent(new Event('input',{bubbles:true})); return {ok:true}; })()`, returnByValue: true }, sid);
      return json(res, 200, { ok: true, ...(r.result?.value ?? {}) });
    }
    if (rota === '/v1/browser/capture') {
      const r = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 70, fromSurface: true }, sid);
      const bytes = Buffer.from(String(r.data || ''), 'base64');
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': bytes.length });
      return res.end(bytes);
    }
    return json(res, 404, { ok: false, error: 'not_found' });
  } catch (erro) { return json(res, 502, { ok: false, error: String(erro.message).slice(0, 160) }); }
});
await gravarCapability();
setInterval(() => renovarToken().catch((e) => console.error('falha ao renovar capability:', e.message)), Math.floor(TTL / 2)).unref();
server.listen(PORTA, '0.0.0.0', () => console.log('GATEWAY HEADLESS VM port=' + PORTA + ' expira=' + new Date(expira).toISOString()));
