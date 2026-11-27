/** Memória persistente por sessão: mensagens, preferências e busca lexical. */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
const ARQUIVO = path.join(DADOS, 'memoria.jsonl');

async function registros() {
  try {
    return (await readFile(ARQUIVO, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

export async function registrarMemoria({ sessao = 'local', canal = 'api', papel = 'usuario', texto, meta = {} }) {
  if (!texto) return null;
  await mkdir(DADOS, { recursive: true });
  const item = { t: new Date().toISOString(), sessao, canal, papel, texto: String(texto).slice(0, 12000), meta };
  await appendFile(ARQUIVO, JSON.stringify(item) + '\n');
  return item;
}

export async function contextoMemoria(sessao = 'local', limite = 8) {
  return (await registros()).filter((r) => r.sessao === sessao && !['preferencia', 'resumo'].includes(r.papel)).slice(-limite);
}

function tokens(texto) {
  return new Set(String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((t) => t.length > 2));
}

function vetor(texto, dimensao = 256) {
  const v = new Float32Array(dimensao);
  for (const t of tokens(texto)) {
    let h = 2166136261;
    for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % dimensao] += 1;
  }
  return v;
}
function similaridade(a, b) {
  let produto = 0, normaA = 0, normaB = 0;
  for (let i = 0; i < a.length; i++) { produto += a[i] * b[i]; normaA += a[i] * a[i]; normaB += b[i] * b[i]; }
  return normaA && normaB ? produto / (Math.sqrt(normaA) * Math.sqrt(normaB)) : 0;
}

export async function buscarMemoria(consulta, { sessao, limite = 6 } = {}) {
  const q = tokens(consulta), vq = vetor(consulta), todos = await registros();
  return todos.filter((r) => (!sessao || r.sessao === sessao) && !['preferencia', 'resumo'].includes(r.papel))
    .map((r) => {
      const ts = tokens(r.texto); let lexical = 0;
      for (const t of q) if (ts.has(t)) lexical++;
      const vetorial = similaridade(vq, vetor(r.texto));
      return { ...r, score: lexical * 2 + vetorial, lexical, vetorial: Math.round(vetorial * 100) / 100 };
    }).filter((r) => r.score > 0.15).sort((a, b) => b.score - a.score || b.t.localeCompare(a.t)).slice(0, limite);
}

export async function resumirMemoria(sessao = 'local', limite = 6) {
  const ctx = await contextoMemoria(sessao, 40);
  if (!ctx.length) return '';
  const texto = ctx.map((r) => r.texto).join(' ');
  const frequencia = {};
  for (const t of tokens(texto)) frequencia[t] = (frequencia[t] || 0) + 1;
  const frases = texto.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25);
  const melhores = frases.map((frase, i) => {
    const ts = [...tokens(frase)];
    const score = ts.reduce((n, t) => n + (frequencia[t] || 0), 0) / Math.sqrt(ts.length || 1);
    return { frase, score, i };
  }).sort((a, b) => b.score - a.score).slice(0, limite).sort((a, b) => a.i - b.i);
  return melhores.map((x) => '- ' + x.frase.slice(0, 400)).join('\n');
}

export async function salvarPreferencia(chave, valor, sessao = 'global') {
  return registrarMemoria({ sessao, canal: 'sistema', papel: 'preferencia', texto: chave + '=' + JSON.stringify(valor), meta: { chave, valor } });
}

export async function preferencias(sessao = 'global') {
  const out = {};
  for (const r of await registros()) if (r.papel === 'preferencia' && r.sessao === sessao && r.meta?.chave) out[r.meta.chave] = r.meta.valor;
  return out;
}

export async function resumirSessao(sessao = 'local', limite = 12) {
  const ctx = await contextoMemoria(sessao, limite);
  return ctx.map((r) => r.papel + ': ' + r.texto.slice(0, 240)).join('\n');
}
