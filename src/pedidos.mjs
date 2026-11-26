/** Fila local de pedidos explícitos de melhoria. O worker consome e testa antes de aplicar. */
import { randomBytes } from 'node:crypto';
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
const ARQUIVO = path.join(DADOS, 'pedidos-melhoria.jsonl');

export async function criarPedido({ objetivo, arquivo, origem = 'local' }) {
  if (!objetivo || String(objetivo).length > 2000) throw new Error('objetivo inválido');
  if (!/^(src|scripts|site|web|docs|config)\//.test(arquivo || '') || arquivo.includes('..')) throw new Error('arquivo fora da allowlist');
  await mkdir(DADOS, { recursive: true });
  const pedido = { id: 'ped-' + randomBytes(6).toString('hex'), objetivo: String(objetivo), arquivo, origem, status: 'pendente', criadoEm: new Date().toISOString() };
  await appendFile(ARQUIVO, JSON.stringify(pedido) + '\n');
  return pedido;
}

export async function listarPendentes() {
  try {
    const linhas = (await readFile(ARQUIVO, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const ultimos = new Map();
    for (const p of linhas) ultimos.set(p.id, p);
    return [...ultimos.values()].filter((p) => p.status === 'pendente').sort((a, b) => a.criadoEm.localeCompare(b.criadoEm));
  } catch { return []; }
}

export async function concluirPedido(id, status, detalhe = '') {
  await mkdir(DADOS, { recursive: true });
  await appendFile(ARQUIVO, JSON.stringify({ id, status, detalhe, atualizadoEm: new Date().toISOString() }) + '\n');
}
