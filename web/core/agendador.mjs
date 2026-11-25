/** Goal no navegador: /plan → /loop → /goal com checkpoint em IndexedDB. Sem servidor local. */
import { orquestrar, plano, executarPasso } from './orquestrador.mjs';
import { avaliar } from '../verificacao/criterios.mjs';

const DB = 'myn-goals';
const STORE = 'goals';
let dbPromise;
function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  return dbPromise;
}
async function tx(modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, modo);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const salvar = (g) => tx('readwrite', (s) => s.put(g));
export const listar = () => tx('readonly', (s) => s.getAll());
const timers = new Map();
const uid = () => 'goal-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function ciclo(g) {
  const inicio = Date.now();
  const p = await plano(g.objetivo).catch(() => ({ passos: [], via: 'deterministico' }));
  const passos = [];
  for (const passo of p.passos.slice(0, g.maxPassos || 4)) {
    const r = await executarPasso(passo).catch((e) => ({ ok: false, detalhe: e.message }));
    const v = avaliar(passo, r);
    passos.push({ ...passo, ...r, verificado: v });
  }
  const registro = { em: new Date().toISOString(), passos, sucessos: passos.filter((x) => x.verificado.ok).length, total: passos.length, ms: Date.now() - inicio, via: p.via };
  g.execucoes = (g.execucoes || []).concat(registro).slice(-20);
  g.ultimaExecucao = registro.em;
  await salvar(g);
  return registro;
}
function agendar(g) {
  if (timers.has(g.id) || !g.ativo) return;
  const t = setInterval(async () => {
    const atual = (await listar()).find((x) => x.id === g.id);
    if (!atual || !atual.ativo || (atual.execucoes || []).length >= atual.maxExecucoes) {
      clearInterval(t); timers.delete(g.id); return;
    }
    await ciclo(atual);
  }, g.intervaloMs || 300000);
  timers.set(g.id, t);
}
export async function criar({ objetivo, intervaloMs = 300000, maxExecucoes = 10, maxPassos = 4, agora = true }) {
  if (!objetivo || String(objetivo).length > 2000) throw new Error('objetivo inválido');
  const g = { id: uid(), objetivo: String(objetivo), intervaloMs, maxExecucoes, maxPassos, ativo: true, criadoEm: new Date().toISOString(), execucoes: [] };
  await salvar(g);
  if (agora) await ciclo(g);
  agendar(g);
  return g;
}
export async function cancelar(id) {
  const g = (await listar()).find((x) => x.id === id);
  if (!g) return false;
  const t = timers.get(id); if (t) { clearInterval(t); timers.delete(id); }
  g.ativo = false; await salvar(g); return true;
}
export async function rodar(id) {
  const g = (await listar()).find((x) => x.id === id);
  if (!g) throw new Error('goal não encontrado');
  return ciclo(g);
}
export async function retomar() { for (const g of await listar()) if (g.ativo) agendar(g); }
