/** Worker de MELHORIA em loop: analisa lacunas, aplica tarefa real, testa, commita e mergeia. Sem Gemini/Google. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { analisarMelhorias, marcar } from './analise.mjs';
import { executarPlugin } from './plugins.mjs';
import { carregarPlugins } from './plugins.mjs';
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
  if (t.modo === 'append') await writeFile(destino, atual.replace(/\s+$/, '') + '\n' + t.conteudo.replace(/^\n+/, '') + '\n');
  else await writeFile(destino, t.conteudo + '\n');
  return t.alvo;
}
async function verificar(arquivo) {
  const checagens = [];
  // Validação real: testes node --test; sintaxe apenas como piso.
  try { await run(process.execPath, ['--test', '--test-force-exit'], { cwd: RAIZ, timeout: 60000 }); checagens.push({ arquivo: 'node --test', ok: true }); }
  catch (e) { checagens.push({ arquivo: 'node --test', ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
  try { await run(process.execPath, ['--check', path.join(RAIZ, arquivo)]); checagens.push({ arquivo, ok: true }); }
  catch (e) { checagens.push({ arquivo, ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
  try { await git(['diff', '--check']); checagens.push({ arquivo: 'git diff --check', ok: true }); }
  catch (e) { checagens.push({ arquivo: 'git diff --check', ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
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
  emitir('patch', { n, id: t.id, titulo: t.titulo, arquivo: t.alvo, via });
  const arquivo = await aplicar(t);
  const checagens = await verificar(arquivo);
  const ok = checagens.every((c) => c.ok);
  emitir('testes', { n, ok, checagens });
  if (!ok) {
    await git(['checkout', '--', arquivo]).catch(() => undefined);
    emitir('revertido', { n, arquivo });
    return { n, ok: false };
  }
  const sujo = await git(['status', '--porcelain']);
  let merge = false;
  if (sujo) {
    await git(['add', '-A']);
    await git(['commit', '-m', 'worker: ' + t.titulo + ' (ciclo ' + n + ')']);
    const seguro = /^(docs\/|config\/)/.test(t.alvo);
    if (seguro) {
      await git(['checkout', 'master']);
      try { await git(['merge', '--ff-only', 'worker/auto']); merge = true; }
      catch { await git(['merge', '--abort']).catch(() => undefined); }
    } else {
      emitir('revisao', { n, arquivo: t.alvo, aviso: 'codigo permanece em worker/auto para revisao' });
    }
    await marcar(t.id);
  }
  emitir('git', { n, merge, tarefa: t.id });
  return { n, ok: true, merge, tarefa: t.id };
}

export async function iniciar({ objetivo = 'melhorar o projeto Myn Recicla', maxCiclos = 1000, intervaloMs = 4000 } = {}) {
  if (ativo) return { ok: false, erro: 'worker de melhoria ja ativo' };
  ativo = true; abortar = false;
  estado = { ciclos: 0, ultimo: null, iniciadoEm: new Date().toISOString(), objetivo: String(objetivo).slice(0, 500) };
  emitir('iniciado', { objetivo: estado.objetivo, rotas: ROTAS });
  let n = 0;
  while (ativo && !abortar && n < maxCiclos) {
    n++; estado.ciclos = n;
    const r = await ciclo(n, estado.objetivo);
    if (r.semTarefas) { emitir('finalizado', { ciclos: n, motivo: 'backlog vazio' }); break; }
    if (abortar) break;
    await new Promise((r2) => setTimeout(r2, Math.max(500, intervaloMs)));
  }
  ativo = false;
  emitir('finalizado', { ciclos: n, motivo: abortar ? 'parado' : 'limite' });
  return { ok: true, ciclos: n };
}
export function parar() { if (!ativo) return { ok: false, erro: 'worker de melhoria nao estava ativo' }; abortar = true; emitir('parando', {}); return { ok: true }; }
