/** Mapeia providers e grava TODA etapa como evidência: input, output, resposta bruta e print. */
import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { carregarConfigAsync, criarGateway } from '../src/gateway.mjs';

const executar = promisify(execFile);
const TESSERACT = process.env.MYNCELLIUM_TESSERACT || 'C:/Program Files/Tesseract-OCR/tesseract.exe';
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [config, base] = await Promise.all([
  carregarConfigAsync(path.join(raiz, 'config/rotas.json')),
  readFile(path.join(raiz, 'config/providers.json'), 'utf8').then(JSON.parse),
]);
await mkdir(path.join(raiz, 'outputs'), { recursive: true });
if (process.env.MYN_GATEWAY_TOKEN_FILE) config.gateway.tokenFile = process.env.MYN_GATEWAY_TOKEN_FILE;
const gateway = criarGateway(config.gateway);
const ids = process.argv.slice(2);
const alvos = ids.length ? base.providers.filter((p) => ids.includes(p.id)) : base.providers;
const PROBE = 'MYN_MAP responda apenas: OK';
const LOGIN = /fazer login|log in|sign in|entrar|cadastrar|inscrever|sign up/i;
const cortar = (v, n = 12000) => (v && typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')).slice(0, n);
const resultados = [];

async function ocr(caminho) {
  const recorte = caminho.replace(/\.jpg$/, '-corte.jpg');
  await executar('python', ['-c', 'from PIL import Image;import sys;i=Image.open(sys.argv[1]);w,h=i.size;i.crop((int(w*0.33),0,w,h)).save(sys.argv[2])', caminho, recorte], { timeout: 30000 }).catch(() => undefined);
  return (await executar(TESSERACT, [recorte, 'stdout', '-l', 'eng'], { timeout: 60000 })).stdout;
}

for (const p of alvos) {
  const iniciado = Date.now();
  const eventos = [];
  const evt = (etapa, input, output) => eventos.push({ t: new Date().toISOString(), etapa, input: cortar(input, 4000), output: cortar(output) });
  const r = { ...p, mapeadoEm: new Date().toISOString() };
  try {
    evt('navigate:input', { url: p.url }, null);
    const nav = await gateway.op('navigate', { url: p.url });
    evt('navigate:output', { url: p.url }, nav);
    await new Promise((x) => setTimeout(x, 2500));
    const texto = await gateway.ler(12000);
    evt('read:output', { limite: 12000 }, texto);
    r.titulo = (await gateway.op('read', { limit: 300 }).catch(() => ({}))).title || '';
    r.loginDetectado = LOGIN.test(texto);
    evt('login_detectado', { padrao: String(LOGIN) }, r.loginDetectado);
    const foco = await gateway.op('focus-composer', {}, AbortSignal.timeout(15000)).then((v) => ({ ok: true, ...v })).catch((e) => ({ ok: false, erro: e.message }));
    evt('focus-composer', {}, foco);
    r.composer = foco.ok;
    if (r.composer) {
      const seq = [
        ['key:Escape', () => gateway.op('key', { key: 'Escape' })],
        ['clear', () => gateway.op('clear')],
        ['type', () => gateway.op('type', { text: PROBE })],
      ];
      for (const [nome, fn] of seq) { const out = await fn().catch((e) => ({ erro: e.message })); evt(nome, nome === 'type' ? { text: PROBE } : {}, out); }
      await new Promise((x) => setTimeout(x, 400));
      if (p.send) { const out = await gateway.op('click', p.send).catch((e) => ({ erro: e.message })); evt('click:enviar', p.send, out); }
      const outEnter = await gateway.op('key', { key: 'Enter' }).catch((e) => ({ erro: e.message }));
      evt('key:Enter', { key: 'Enter' }, outEnter);
      r.envio = { probe: PROBE, via: p.send ? 'click' : 'Enter' };
      let respostaBruta = '';
      const fotos = [];
      for (let i = 0; i < 10; i++) {
        await new Promise((x) => setTimeout(x, 2000));
        const arquivo = path.join(raiz, 'outputs', 'mapa-' + p.id + '-' + (i + 1) + '.jpg');
        try {
          await gateway.captura(arquivo);
          respostaBruta = await ocr(arquivo);
          fotos.push(path.relative(raiz, arquivo).replaceAll('\\', '/'));
        } catch { respostaBruta = await gateway.ler(12000); }
        evt('resposta_bruta_' + (i + 1), { tentativa: i + 1, print: fotos.at(-1) || null }, respostaBruta);
        if (/OK/i.test(respostaBruta)) break;
      }
      r.respostaBruta = respostaBruta;
      r.respostaOk = /OK/i.test(respostaBruta);
      r.prints = fotos;
    }
    r.estado = r.respostaOk ? 'utilizavel' : r.loginDetectado ? 'login' : r.composer ? 'sem_resposta' : 'bloqueado';
  } catch (erro) {
    r.estado = 'erro';
    r.erro = String(erro.message).slice(0, 200);
    evt('erro', {}, r.erro);
  }
  r.ms = Date.now() - iniciado;
  r.eventos = eventos;
  delete r.send;
  resultados.push(r);
  console.log(JSON.stringify({ id: p.id, estado: r.estado, eventos: eventos.length, prints: (r.prints || []).length, ms: r.ms }));
}

const relatorio = { em: new Date().toISOString(), gateway: config.gateway.base, probe: PROBE, resultados };
const json = JSON.stringify(relatorio, null, 2);
await writeFile(path.join(raiz, 'site/mapeamento.json'), json);
await writeFile(path.join(raiz, 'outputs-evidencia-mapeamento.json'), json);
console.log(JSON.stringify({ total: resultados.length, utilizaveis: resultados.filter((r) => r.estado === 'utilizavel').length, eventos: resultados.reduce((n, r) => n + r.eventos.length, 0) }, null, 2));
