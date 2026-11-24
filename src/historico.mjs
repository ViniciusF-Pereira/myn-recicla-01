/** Histórico JSONL + cache de conteúdo, persistidos em disco (volume na VM). */
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIR = process.env.MYN_DADOS || path.resolve('dados');
const ARQ = path.join(DIR, 'historico.jsonl');
const CACHE = path.join(DIR, 'cache.json');
await mkdir(DIR, { recursive: true });

export async function registrar(tipo, dados) {
  const linha = JSON.stringify({ t: new Date().toISOString(), tipo, ...dados }) + '\n';
  await appendFile(ARQ, linha).catch(() => {});
  return linha;
}
export async function listar(tipo, limite = 50) {
  const texto = await readFile(ARQ, 'utf8').catch(() => '');
  return texto.split(/\r?\n/).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r && (!tipo || r.tipo === tipo)).slice(-limite).reverse();
}
async function lerCache() { return JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}')); }
export async function cacheGet(chave, ttlMs = 10 * 60_000) {
  const dados = await lerCache();
  const item = dados[chave];
  if (!item) return null;
  if (Date.now() - item.at > ttlMs) { delete dados[chave]; await writeFile(CACHE, JSON.stringify(dados)); return null; }
  return item.valor;
}
export async function cacheSet(chave, valor) {
  const dados = await lerCache();
  dados[chave] = { at: Date.now(), valor };
  await writeFile(CACHE, JSON.stringify(dados));
  return valor;
}
export async function cacheChaves() {
  const dados = await lerCache();
  return Object.entries(dados).map(([chave, v]) => ({ chave, idadeMs: Date.now() - v.at, tamanho: JSON.stringify(v.valor).length }));
}
export async function limparTipo(tipo) {
  const atual = await listar(null, 100000);
  await writeFile(ARQ, atual.filter((r) => r.tipo !== tipo).map((r) => JSON.stringify(r)).join('\n') + '\n');
}
