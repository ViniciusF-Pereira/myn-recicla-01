/** VM web escalável: Web Worker isolado, HD virtual em IndexedDB e cache próprio. */
import { inserir, listar, obter } from '../db/leve.mjs';

const CODIGO = `
const esc = (s) => String(s ?? '');
self.onmessage = async (e) => {
  const { id, op, args = {} } = e.data;
  let ok = true, resultado = null;
  try {
    if (op === 'eco') resultado = esc(args.texto);
    else if (op === 'soma') resultado = (args.numeros || []).reduce((a, b) => a + Number(b), 0);
    else if (op === 'mapa') resultado = (args.itens || []).map(args.fn || String);
    else if (op === 'hash') {
      let h = 0; for (const c of esc(args.texto)) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
      resultado = Math.abs(h).toString(16);
    } else if (op === 'analisar') {
      const t = esc(args.texto);
      resultado = { chars: t.length, palavras: t.split(/\\W+/).filter(Boolean).length, minusculas: (t.match(/[a-z]/g) || []).length };
    } else throw new Error('op desconhecida: ' + op);
  } catch (erro) { ok = false; resultado = erro.message; }
  self.postMessage({ id, ok, resultado });
};
`;

export class VMWeb {
  constructor(nome = 'myn-vm') {
    this.nome = nome;
    this.worker = null;
    this.seq = 0;
    this.pendentes = new Map();
    this.iniciada = false;
  }
  async iniciar() {
    if (this.iniciada) return this;
    const url = URL.createObjectURL(new Blob([CODIGO], { type: 'text/javascript' }));
    this.worker = new Worker(url);
    URL.revokeObjectURL(url);
    this.worker.onmessage = (e) => {
      const p = this.pendentes.get(e.data.id);
      if (p) { p(e.data); this.pendentes.delete(e.data.id); }
    };
    await inserir('sessoes', { id: this.nome, tipo: 'vm', em: Date.now(), estado: 'ativa' });
    this.iniciada = true;
    return this;
  }
  async executar(op, args = {}) {
    if (!this.iniciada) await this.iniciar();
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pendentes.delete(id); reject(new Error('timeout VM ' + op)); }, 15000);
      this.pendentes.set(id, (r) => { clearTimeout(timer); r.ok ? resolve(r.resultado) : reject(new Error(r.resultado)); });
      this.worker.postMessage({ id, op, args });
    });
  }
  async HD() { return listar('arquivos', 500); }
  async gravar(nome, conteudo) { return inserir('arquivos', { nome, conteudo: String(conteudo), t: Date.now() }); }
  async cache(chave) { return obter('cache', chave); }
  async gravarCache(chave, valor) { return inserir('cache', { id: chave, valor, t: Date.now() }); }
  parar() { if (this.worker) this.worker.terminate(); this.iniciada = false; }
}
