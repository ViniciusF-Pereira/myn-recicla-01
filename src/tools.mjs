/** Ferramentas mínimas, com escopo rígido. Nada sai do workspace. */
import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const executar = promisify(execFile);
const NOMES = new Set(['write_file', 'read_file', 'list_files', 'run_tests']);

export function criarFerramentas(workspace, permitidosRecebidos) {
  const permitidos = permitidosRecebidos instanceof Set ? permitidosRecebidos : new Set(permitidosRecebidos);
  function caminhoSeguro(nome) {
    const limpo = String(nome ?? '').replace(/\.[a-z]+$/i, '');
    if (!permitidos.has(limpo)) throw new Error('arquivo fora do escopo: ' + limpo);
    return path.join(workspace, limpo + '.txt');
  }
  return {
    nomes: [...NOMES],
    async executar(tool, args = {}) {
      if (!NOMES.has(tool)) throw new Error('tool não disponível: ' + tool);
      if (tool === 'write_file') {
        const file = caminhoSeguro(args.path);
        await rm(file, { force: true });
        const content = String(args.content ?? '');
        if (!content || content.length > 4096) throw new Error('content inválido');
        await writeFile(file, content);
        return { ok: true, path: path.basename(file) };
      }
      if (tool === 'read_file') {
        const file = caminhoSeguro(args.path);
        return { ok: true, content: await readFile(file, 'utf8').catch(() => '') };
      }
      if (tool === 'list_files') {
        return { ok: true, files: (await readdir(workspace)).filter((f) => f.endsWith('.txt')) };
      }
      if (tool === 'run_tests') {
        const permitido = /^(node --test|npm test)$/.test(String(args.cmd ?? ''));
        if (!permitido) throw new Error('comando não permitido');
        try {
          const r = await executar('node', ['--test', '--test-force-exit'], { cwd: workspace, timeout: 30000 });
          return { ok: true, output: String(r.stdout).slice(0, 2000) };
        } catch (e) {
          return { ok: false, output: String(e.stdout ?? e.stderr ?? e.message).slice(0, 2000) };
        }
      }
    },
  };
}
