/** Gateway mediado: cliente mínimo. Nunca exponha CDP bruto, cookies ou código do chamador. */
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
const executar = promisify(execFile);
const TESSERACT = process.env.MYN_TESSERACT || process.env.MYNCELLIUM_TESSERACT || 'tesseract';

export async function carregarConfigAsync(caminho = resolve('config/rotas.json')) {
  return JSON.parse(await readFile(caminho, 'utf8'));
}

export async function tokenGateway(arquivo) {
  const cru = (await readFile(arquivo, 'utf8')).trim();
  try {
    const cap = JSON.parse(cru);
    if (typeof cap.token !== 'string' || !cap.token) throw new Error('capability inválida');
    if (typeof cap.expiresAt === 'number' && Date.now() > cap.expiresAt) throw new Error('capability expirada');
    return cap.token;
  } catch (erro) {
    if (erro.message === 'capability inválida' || erro.message === 'capability expirada') throw erro;
    return cru; // token legado
  }
}

export function criarGateway({ base, tokenFile }) {
  let tokenCache;
  async function token() { tokenCache = await tokenGateway(tokenFile); return tokenCache; }
  async function op(nome, body = {}, signal = AbortSignal.timeout(60000)) {
    const executar = async () => {
      const tok = await token();
      return fetch(base.replace(/\/$/, '') + '/v1/browser/' + nome, {
        method: 'POST',
        headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' },
        body: JSON.stringify(body), signal,
      });
    };
    let r = await executar();
    if (r.status === 401) { tokenCache = undefined; r = await executar(); } // gateway reiniciado: renova o token
    const valor = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(nome + ' ' + r.status + ' ' + JSON.stringify(valor));
    return valor;
  }
  return {
    op,
    async targets() {
      const tok = await token();
      const r = await fetch(base.replace(/\/$/, '') + '/v1/browser/targets', { headers: { authorization: 'Bearer ' + tok } });
      return (await r.json()).targets ?? [];
    },
    async ativar(urlParcial) {
      const alvo = (await this.targets()).find((t) => t.url.includes(urlParcial));
      if (!alvo) throw new Error('aba não encontrada: ' + urlParcial);
      return op('activate', { targetId: alvo.id });
    },
    async enviar(texto, send) {
      await op('key', { key: 'Escape' }).catch(() => undefined);
      await op('focus-composer').catch(() => op('focus').catch(() => undefined));
      await op('clear').catch(() => undefined);
      await op('type', { text: texto });
      await new Promise((r) => setTimeout(r, 400));
      if (send && Number.isFinite(send.x) && Number.isFinite(send.y)) {
        await op('click', send);
        await new Promise((r) => setTimeout(r, 300));
        await op('click', send).catch(() => undefined);
      }
      await op('key', { key: 'Enter' }).catch(() => undefined);
    },
    async ler(limite = 12000) {
      try {
        const v = await op('read-all', { limit: limite });
        return String(v.text ?? '');
      } catch {
        const v = await op('read', { limit: limite });
        return String(v.text ?? '');
      }
    },
    async resposta(prompt, tentativas = 20, intervalo = 2500, aceitarQualquer = false, sinal) {
      const semAcento = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const alvoNorm = semAcento(prompt);
      const ancora = alvoNorm.slice(0, Math.min(18, alvoNorm.length));
      for (let i = 0; i < tentativas; i++) {
        if (sinal?.aborted) return '';
        await new Promise((r) => setTimeout(r, intervalo));
        let texto = '';
        try {
          const cru = 'C:/Users/Vini/AppData/Local/Temp/myn-portable-ocr.jpg';
          const corte = 'C:/Users/Vini/AppData/Local/Temp/myn-portable-ocr-corte.jpg';
          await this.captura(cru);
          // Recorta a sidebar: o OCR deve ler só a conversa principal.
          await executar('python', ['-c', 'from PIL import Image;import sys;i=Image.open(sys.argv[1]);w,h=i.size;i.crop((int(w*0.33),0,w,h)).save(sys.argv[2])', cru, corte], { timeout: 30000 }).catch(() => undefined);
          texto = (await executar(TESSERACT, [corte, 'stdout', '-l', 'eng'], { timeout: 60000 })).stdout;
        } catch { texto = await this.ler(); }
        const norm = semAcento(texto);
        const idx = norm.lastIndexOf(ancora);
        if (idx < 0) continue;
        let depois = norm.slice(idx + ancora.length).replace(/^[\s\W_]+/, '').trim();
        if (depois.startsWith(alvoNorm.slice(ancora.length))) depois = depois.slice(alvoNorm.length - ancora.length).trim();
        if (depois && (aceitarQualquer || /T[0O]OL|DONE|FINAL/i.test(depois))) {
          // Remove eco do prompt que o OCR pode capturar da bolha do usuário.
          const limpo = depois
            .replace(/você é um agente[^.\n]*[.\n]?/gi, '')
            .replace(/use no máximo uma linha[^.\n]*[.\n]?/gi, '')
            .replace(/tool\s*<ferramenta>[^\n]*\n?/gi, '')
            .replace(/use tool write_file[^\n]*\n?/gi, '')
            .replace(/contexto recuperado[^\n]*\n?/gi, '')
            .replace(/ferramentas:\s*write_file[^\n]*\n?/gi, '')
            .replace(/comece\.?/gi, '')
            .replace(/\s{3,}/g, ' ')
            .trim();
          return limpo || depois.trim();
        }
      }
      return '';
    },
    async captura(caminho) {
      const tok = await token();
      const r = await fetch(base.replace(/\/$/, '') + '/v1/browser/capture', {
        method: 'POST', headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json' }, body: '{}',
      });
      await (await import('node:fs/promises')).writeFile(caminho, Buffer.from(await r.arrayBuffer()));
    },
  };
}

/** Serializa operações de navegador quando vários workers compartilham a mesma aba. */
export function criarTrava() {
  let cadeia = Promise.resolve();
  return (fn) => {
    const r = cadeia.then(fn, fn);
    cadeia = r.then(() => undefined, () => undefined);
    return r;
  };
}
export async function pingGateway(base){try{const r=await fetch(String(base).replace(/\/$/,"")+"/v1/browser/targets",{signal:AbortSignal.timeout(5000)});return r.ok}catch{return false}}
