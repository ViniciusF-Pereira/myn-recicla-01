/** RAG no navegador: TF-IDF indexado em IndexedDB, pronto para receber embeddings WebGPU. */
const DB = 'myn-rag';
const STORE = 'docs';
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
export async function indexar(documentos) {
  await tx('readwrite', (s) => s.clear());
  const lista = documentos.map((d, i) => ({ id: String(d.id || i), titulo: String(d.titulo || ''), texto: String(d.texto || '') }));
  for (const d of lista) await tx('readwrite', (s) => s.put(d));
  return lista.length;
}
export async function documentos() { return tx('readonly', (s) => s.getAll()); }
export function tokens(s) {
  return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 2);
}
export async function buscar(q, limite = 5) {
  const docs = await documentos();
  const termos = tokens(q);
  if (!termos.length || !docs.length) return [];
  const df = new Map();
  for (const t of termos) df.set(t, docs.filter((d) => tokens(d.texto).includes(t)).length);
  const N = docs.length;
  return docs.map((d) => {
    const tf = tokens(d.texto);
    const score = termos.reduce((n, t) => {
      const f = tf.filter((x) => x === t).length;
      const idf = Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;
      return n + (f ? (1 + Math.log(f)) * idf : 0);
    }, 0);
    return { fonte: d.titulo || d.id, score, trecho: String(d.texto).slice(0, 240) };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score).slice(0, limite);
}
