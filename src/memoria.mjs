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

export async function buscarMemoria(consulta, { sessao, limite = 6 } = {}) {
  const q = tokens(consulta), todos = await registros();
  return todos.filter((r) => (!sessao || r.sessao === sessao) && !['preferencia', 'resumo'].includes(r.papel))
    .map((r) => {
      const ts = tokens(r.texto); let score = 0;
      for (const t of q) if (ts.has(t)) score++;
      return { ...r, score };
    }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score || b.t.localeCompare(a.t)).slice(0, limite);
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
