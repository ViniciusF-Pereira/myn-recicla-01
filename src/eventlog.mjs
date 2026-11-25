/** Histórico append-only dos workers em JSONL, separado do Git. */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');

export async function registrarEvento(nome, evento) {
  await mkdir(DADOS, { recursive: true });
  await appendFile(path.join(DADOS, 'worker-' + nome + '-eventos.jsonl'), JSON.stringify(evento) + '\n', 'utf8');
}

export async function lerEventos(nome, limite = 100) {
  try {
    const texto = await readFile(path.join(DADOS, 'worker-' + nome + '-eventos.jsonl'), 'utf8');
    return texto.trim().split(/\r?\n/).filter(Boolean).slice(-Math.max(1, Math.min(1000, limite))).map((l) => JSON.parse(l));
  } catch { return []; }
}
