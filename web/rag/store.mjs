/** RAG no navegador: TF-IDF + vetor hash local + embedding WebGPU opcional, persistido em IndexedDB. */
import { vetorHash, scoreHibrido, idfDocumentos, trechoRelevante } from './ranking.mjs';
import { embeddings as embeddingsGPU } from '../inferencia/embeddings-gpu.mjs';

const DB = 'myn-rag-hibrido';
const STORE = 'docs';
let dbPromise;
function abrir() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
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

function pedacos(texto, tamanho = 1200) {
  const limpo = String(texto || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const saida = [];
  for (let i = 0; i < limpo.length; i += tamanho - 150) saida.push(limpo.slice(i, i + tamanho));
  return saida.filter((p) => p.trim().length > 40);
}

export async function indexar(documentos, { substituir = true, neural = false } = {}) {
  if (substituir) await tx('readwrite', (s) => s.clear());
  const lista = documentos.flatMap((d, i) => pedacos(d.texto).map((texto, n) => ({
    id: String(d.id || i) + '#' + n, titulo: String(d.titulo || d.id || 'documento'), texto, vetor: Array.from(vetorHash(texto)),
  }))).filter((d) => d.texto);
  if (neural && lista.length) {
    const vetores = await embeddingsGPU(lista.map((d) => d.texto)).catch(() => null);
    if (Array.isArray(vetores) && vetores.length === lista.length) lista.forEach((d, i) => { d.vetorNeural = vetores[i]; });
  }
  for (const d of lista) await tx('readwrite', (s) => s.put(d));
  return lista.length;
}
export async function adicionar(documento, { neural = false } = {}) { return indexar([documento], { substituir: false, neural }); }
export async function documentos() { return tx('readonly', (s) => s.getAll()); }
export { tokens } from './ranking.mjs';

export async function buscar(q, limite = 5, { neural = false } = {}) {
  const docs = await documentos();
  if (!docs.length) return [];
  const consulta = String(q || '');
  const idf = idfDocumentos(docs, consulta);
  const vq = vetorHash(consulta);
  const neuralConsulta = neural ? await embeddingsGPU([consulta]).catch(() => null) : null;
  const vnq = Array.isArray(neuralConsulta) && Array.isArray(neuralConsulta[0]) ? neuralConsulta[0] : null;
  return docs.map((d) => {
    const r = scoreHibrido(consulta, d.texto, { idf, vetorConsulta: vq, vetorDocumento: d.vetor, vetorNeuralConsulta: vnq, vetorNeuralDocumento: d.vetorNeural });
    return { id: d.id, fonte: d.titulo || d.id, trecho: trechoRelevante(d.texto, consulta), score: r.score, lexical: r.lexical, vetorial: r.vetorial, neural: r.neural };
  }).filter((r) => r.score > 0.15).sort((a, b) => b.score - a.score).slice(0, limite);
}

export async function exportar() { return { _myn: 'myn-rag', _versao: 2, documentos: await documentos() }; }
export async function importar(json) {
  if (json?._myn !== 'myn-rag' || !Array.isArray(json.documentos)) throw new Error('arquivo RAG inválido');
  await tx('readwrite', (s) => s.clear());
  for (const d of json.documentos.slice(0, 10000)) await tx('readwrite', (s) => s.put(d));
  return json.documentos.length;
}
export async function limpar() { await tx('readwrite', (s) => s.clear()); }
export async function gerarEmbeddings() {
  const docs = await documentos();
  if (!docs.length) return 0;
  const vetores = await embeddingsGPU(docs.map((d) => d.texto)).catch(() => null);
  if (!Array.isArray(vetores) || vetores.length !== docs.length) throw new Error('WebGPU/embedding indisponível');
  for (let i = 0; i < docs.length; i++) await tx('readwrite', (s) => s.put({ ...docs[i], vetorNeural: vetores[i] }));
  return docs.length;
}
export async function estatisticas() { const docs = await documentos(); return { documentos: docs.length, neural: docs.filter((d) => d.vetorNeural).length, caracteres: docs.reduce((n, d) => n + d.texto.length, 0) }; }
