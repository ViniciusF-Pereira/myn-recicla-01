/** Lock de processo para impedir dois workers escrevendo no mesmo repositório. */
import { open, readFile, unlink, mkdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');

function vivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

export async function adquirirLock(nome) {
  await mkdir(DADOS, { recursive: true });
  const arquivo = path.join(DADOS, 'worker-' + nome + '.lock');
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      const h = await open(arquivo, 'wx');
      const dados = { pid: process.pid, host: os.hostname(), startedAt: new Date().toISOString() };
      await h.writeFile(JSON.stringify(dados));
      await h.close();
      return { ok: true, arquivo, liberar: async () => {
        try {
          const atual = JSON.parse(await readFile(arquivo, 'utf8'));
          if (atual.pid === process.pid) await unlink(arquivo);
        } catch { /* já removido */ }
      } };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try {
        const dados = JSON.parse(await readFile(arquivo, 'utf8'));
        if (vivo(dados.pid)) return { ok: false, motivo: 'worker já ativo', pid: dados.pid, host: dados.host };
        // PID morto: lock órfão, pode ser removido imediatamente.
      } catch { /* lock inválido */ }
      await unlink(arquivo).catch(() => {});
    }
  }
  return { ok: false, motivo: 'não foi possível adquirir lock' };
}
