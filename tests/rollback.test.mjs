import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const run = promisify(execFile);
const modulo = pathToFileURL(path.resolve('src/worker-melhoria.mjs')).href;

test('smoke falho reverte merge e branch sem perder o estado anterior', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'myn-rollback-'));
  const git = (args) => run('git', args, { cwd: dir });
  try {
    await git(['init', '-q']);
    await git(['config', 'user.email', 'teste@local']);
    await git(['config', 'user.name', 'Teste']);
    await mkdir(path.join(dir, 'src'));
    await writeFile(path.join(dir, 'src', 'x.mjs'), 'export const x = 1;\n');
    await git(['add', '-A']);
    await git(['commit', '-qm', 'base']);
    const base = (await git(['rev-parse', 'master'])).stdout.trim();
    await git(['checkout', '-qb', 'worker/auto']);
    await writeFile(path.join(dir, 'src', 'x.mjs'), 'export const x = 2;\n');
    await git(['add', '-A']);
    await git(['commit', '-qm', 'mudanca']);
    await git(['checkout', '-q', 'master']);

    const script = `import { mesclarBranch } from ${JSON.stringify(modulo)}; console.log(JSON.stringify(await mesclarBranch(1, true)));`;
    const resultado = await run(process.execPath, ['--input-type=module', '-e', script], {
      cwd: dir,
      env: { ...process.env, MYN_API_BASE: 'http://127.0.0.1:59999', MYN_DADOS: path.join(dir, 'dados'), MYN_AUTO_PUSH: '0' },
    });
    assert.equal(JSON.parse(resultado.stdout.trim()), false);
    assert.equal((await git(['rev-parse', 'master'])).stdout.trim(), base);
    assert.equal((await git(['rev-parse', 'worker/auto'])).stdout.trim(), base);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
