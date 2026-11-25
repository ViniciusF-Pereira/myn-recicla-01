/** Virtual FS no navegador. Nada toca o disco do PC: IndexedDB + download explícito. */
import { seguro } from './reparo.mjs';

const DB = 'myn-virtual-fs';
const STORE = 'arquivos';
let dbPromise;

function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
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
export async function escrever(nome, conteudo) {
  const n = seguro(nome);
  await tx('readwrite', (s) => s.put(String(conteudo ?? ''), n));
  return n;
}
export async function ler(nome) { return tx('readonly', (s) => s.get(seguro(nome))); }
export async function listar() { return tx('readonly', (s) => s.getAllKeys()); }
export function baixar(nome, conteudo, tipo = 'text/plain') {
  const blob = new Blob([String(conteudo ?? '')], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = seguro(nome);
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export async function executar(comando) {
  if (!comando || comando.acao) return { ok: false, erro: 'sem_comando' };
  const permitidas = new Set(['write_file', 'read_file', 'list_files', 'nota', 'resultado']);
  if (!permitidas.has(comando.tool)) return { ok: false, erro: 'fora_do_escopo' };
  try {
    if (comando.tool === 'write_file' || comando.tool === 'nota' || comando.tool === 'resultado') {
      const nome = await escrever(comando.args?.path, comando.args?.content);
      return { ok: true, nome };
    }
    if (comando.tool === 'read_file') return { ok: true, conteudo: await ler(comando.args?.path) };
    return { ok: true, arquivos: await listar() };
  } catch (e) { return { ok: false, erro: String(e.message).slice(0, 120) }; }
}
