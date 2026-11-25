/** Worker de MELHORIA em loop: analisa lacunas, aplica tarefa real, testa, commita e mergeia. Sem Gemini/Google. */
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { analisarMelhorias, marcar } from './analise.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const RAIZ = process.cwd();
let ativo = false, abortar = false;
const inscritos = new Set();
let estado = { ciclos: 0, ultimo: null, iniciadoEm: null, objetivo: null };

function emitir(tipo, dados = {}) {
  const ev = { t: new Date().toISOString(), tipo, ...dados };
  for (const fn of inscritos) { try { fn(ev); } catch { /* morto */ } }
  estado.ultimo = ev;
}
export function assinar(fn) { inscritos.add(fn); return () => inscritos.delete(fn); }
export function status() { return { ativo, ...estado, inscritos: inscritos.size }; }
async function git(args) { return String((await run('git', args, { cwd: RAIZ, timeout: 60000 })).stdout || '').trim(); }

async function garantirBranch() {
  const atual = await git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (atual !== 'worker/auto') await git(['checkout', '-B', 'worker/auto', 'master']).catch(() => git(['checkout', 'worker/auto']));
}

async function aplicar(t) {
  const destino = path.join(RAIZ, t.alvo);
  let atual = '';
  try { atual = await readFile(destino, 'utf8'); } catch { /* criar */ }
  const corpo = String(t.conteudo).replace(/^\n+|\n+$/g, '');
  if (t.modo === 'append') await writeFile(destino, atual.replace(/\s+$/, '') + '\n' + corpo + '\n');
  else await writeFile(destino, corpo + '\n');
  return t.alvo;
}
async function temTestes() {
  for (const dir of ['test', 'tests', '__tests__']) {
    try { if ((await readdir(path.join(RAIZ, dir))).length) return true; } catch { /* não existe */ }
  }
  try {
    return (await readdir(path.join(RAIZ, 'scripts'))).some((n) => /\.(test|spec)\.(mjs|js)$/.test(n));
  } catch { return false; }
}

async function verificar(arquivo) {
  const checagens = [];
  // Validação behavioral só quando existem testes; sintaxe é o piso sempre.
  if (await temTestes()) {
    try { await run(process.execPath, ['--test'], { cwd: RAIZ, timeout: 60000 }); checagens.push({ arquivo: 'node --test', ok: true }); }
    catch (e) { checagens.push({ arquivo: 'node --test', ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
  } else {
    checagens.push({ arquivo: 'sem testes no projeto', ok: true, nota: 'sintaxe + diff check' });
  }
  if (/\.(mjs|js|cjs)$/.test(arquivo)) {
    try { await run(process.execPath, ['--check', path.join(RAIZ, arquivo)]); checagens.push({ arquivo, ok: true }); }
    catch (e) { checagens.push({ arquivo, ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
  } else {
    checagens.push({ arquivo, ok: true, nota: 'documento/config' });
  }
  try { await git(['diff', '--check']); checagens.push({ arquivo: 'git diff --check', ok: true }); }
  catch (e) { checagens.push({ arquivo: 'git diff --check', ok: false, erro: String(e.stdout || e.stderr || e.message).trim().slice(0, 240) }); }
  return checagens;
}

/** Rotas permitidas: Somente free e NÃO Google. */
const ROTAS = ['pollinations-text-api', 'openrouter', 'brave-leo', 'kimi', 'hugging'];

async function ciclo(n, objetivo) {
  emitir('ciclo_inicio', { n, objetivo: objetivo.slice(0, 200) });
  const analise = await analisarMelhorias();
  emitir('analise', { n, ...analise.analise });
  if (!analise.tarefa) { emitir('sem_tarefas', { n }); return { n, semTarefas: true }; }
  const t = analise.tarefa;
  await garantirBranch();
  emitir('branch', { n, branch: await git(['rev-parse', '--abbrev-ref', 'HEAD']) });

  const via = 'analise-local';
  const existia = await readFile(path.join(RAIZ, t.alvo), 'utf8').then(() => true).catch(() => false);
  emitir('patch', { n, id: t.id, titulo: t.titulo, arquivo: t.alvo, via });
  const arquivo = await aplicar(t);
  const checagens = await verificar(arquivo);
  const ok = checagens.every((c) => c.ok);
  emitir('testes', { n, ok, checagens });
  if (!ok) {
    if (existia) await git(['checkout', '--', arquivo]).catch(() => undefined);
    else await unlink(path.join(RAIZ, arquivo)).catch(() => undefined);
    emitir('revertido', { n, arquivo, tarefa: t.id });
    return { n, ok: false, tarefa: t.id };
  }
  // Commita apenas o arquivo da tarefa e o marcador — nunca mudanças alheias da árvore.
  await marcar(t.id);
  await git(['add', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']).catch(() => undefined);
  const pendente = await git(['status', '--porcelain', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']);
  let merge = false;
  if (pendente) {
    await git(['commit', '-m', 'worker: ' + t.titulo + ' (ciclo ' + n + ')', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']);
    const seguro = /^(docs\/|config\/)/.test(t.alvo);
    if (seguro) {
      await git(['checkout', 'master']);
      try { await git(['merge', '--ff-only', 'worker/auto']); merge = true; }
      catch { await git(['merge', '--abort']).catch(() => undefined); }
    } else {
      emitir('revisao', { n, arquivo: t.alvo, aviso: 'codigo permanece em worker/auto para revisao' });
    }
  } else {
    emitir('sem_alteracao', { n, arquivo });
  }
  emitir('git', { n, merge, tarefa: t.id });
  return { n, ok: true, merge, tarefa: t.id };
}

export async function iniciar({ objetivo = 'melhorar o projeto Myn Recicla', maxCiclos = 1000, intervaloMs = 4000 } = {}) {
  if (ativo) return { ok: false, erro: 'worker de melhoria ja ativo' };
  ativo = true; abortar = false;
  estado = { ciclos: 0, ultimo: null, iniciadoEm: new Date().toISOString(), objetivo: String(objetivo).slice(0, 500) };
  emitir('iniciado', { objetivo: estado.objetivo, rotas: ROTAS });
  let n = 0, motivo = 'limite', falhou = null, falhas = 0;
  while (ativo && !abortar && n < maxCiclos) {
    n++; estado.ciclos = n;
    const r = await ciclo(n, estado.objetivo);
    if (r.semTarefas) { motivo = 'backlog vazio'; break; }
    if (abortar) { motivo = 'parado'; break; }
    if (r.ok === false) {
      if (r.tarefa === falhou) falhas++; else { falhou = r.tarefa; falhas = 1; }
      if (falhas >= 2) { emitir('bloqueado', { tarefa: falhou, aviso: 'tarefa falhou 2x; parando para revisão' }); motivo = 'tarefa bloqueada'; break; }
    } else { falhou = null; falhas = 0; }
    await new Promise((r2) => setTimeout(r2, Math.max(500, intervaloMs)));
  }
  ativo = false;
  emitir('finalizado', { ciclos: n, motivo });
  return { ok: true, ciclos: n, motivo };
}
export function parar() { if (!ativo) return { ok: false, erro: 'worker de melhoria nao estava ativo' }; abortar = true; emitir('parando', {}); return { ok: true }; }
