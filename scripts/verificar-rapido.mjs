import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
export async function verificarRapido() {
  const falhas=[];
  for (const d of ['src','scripts']) {
    let ns=[]; try { ns=await readdir(path.resolve(d)); } catch { continue }
    for (const n of ns.filter(x=>x.endsWith('.mjs'))) { try { await run(process.execPath,['--check',path.resolve(d,n)]) } catch(e){ falhas.push(d+'/'+n) } }
  }
  return { ok: falhas.length===0, falhas };
}

