/** Worker autônomo: planeja → usa rotas free → aplica patch → testa → commit → merge. Streama cada etapa. */
import { execFile } from 'node:child_process';
import { appendFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { planejar } from './planejador.mjs';
import { respostaRapida } from './stream.mjs';
import { relatorio as relatorioSaude } from './saude.mjs';

const executar = promisify(execFile);
const RAIZ = process.cwd();
const BRANCH = 'worker/auto';
const ALVO = 'master';
const PERMITIDO = /^(docs\/[\w.-]+\.md|src\/[\w.-]+\.mjs|scripts\/[\w.-]+\.mjs|config\/[\w.-]+\.json)$/;

let ativo = false;
let abortar = false;
const inscritos = new Set();
let estado = { ciclos: 0, ultimo: null, iniciadoEm: null, objetivo: null };

function emitir(tipo, dados = {}) {
  const ev = { t: new Date().toISOString(), tipo, ...dados };
  for (const fn of inscritos) { try { fn(ev); } catch { /* assinante morreu */ } }
  estado.ultimo = ev;
  return ev;
}
export function assinar(fn) { inscritos.add(fn); return () => inscritos.delete(fn); }
export function status() { return { ativo, ...estado, inscritos: inscritos.size }; }

async function git(args) {
  const r = await executar('git', args, { cwd: RAIZ, timeout: 60000, maxBuffer: 4 * 1024 * 1024 });
  return String(r.stdout || '').trim();
}
async function branchAtual() { return git(['rev-parse', '--abbrev-ref', 'HEAD']); }
async function garantirBranch() {
  const atual = await branchAtual();
  if (atual === BRANCH) return;
  try { await git(['checkout', '-B', BRANCH, ALVO]); }
  catch { await git(['checkout', BRANCH]); }
}
async function statusSujo() { return git(['status', '--porcelain']); }

/** Higienização: remove só temporários conhecidos, dentro de dados/arquivos e do workspace. */
async function higienizar() {
  const removidos = [];
  const bases = [path.join(RAIZ, 'dados', 'arquivos'), path.join(RAIZ, '.playground-workspace')];
  for (const base of bases) {
    let nomes = [];
    try { nomes = await readdir(base); } catch { continue; }
    for (const nome of nomes) {
      if (!/^(tmp-|paleta-|smoke\.txt$|\.DS_Store$)/.test(nome)) continue;
      const alvo = path.join(base, nome);
      try { await rm(alvo, { force: true, recursive: true }); removidos.push(path.relative(RAIZ, alvo)); } catch { /* ignora */ }
    }
  }
  return removidos;
}

function extrairJson(texto) {
  const s = String(texto || '');
  const m = /\{[\s\S]*?"arquivo"[\s\S]*?\}/.exec(s);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
function validarPatch(p) {
  if (!p || typeof p !== 'object') return false;
  if (!PERMITIDO.test(String(p.arquivo || ''))) return false;
  if (!['append', 'replace'].includes(p.modo)) return false;
  const c = String(p.conteudo || '');
  return c.length > 10 && c.length < 20000;
}
async function aplicarPatch(p) {
  const destino = path.join(RAIZ, p.arquivo);
  if (p.modo === 'append') await appendFile(destino, '\n' + p.conteudo.replace(/^\n+/, '') + '\n');
  else await writeFile(destino, p.conteudo + '\n');
  return p.arquivo;
}
async function checar(arquivos) {
  const saidas = [];
  for (const a of arquivos) {
    if (/\.mjs$|\.js$/.test(a)) {
      try { await executar(process.execPath, ['--check', a], { cwd: RAIZ, timeout: 30000 }); saidas.push({ arquivo: a, ok: true }); }
      catch (e) { saidas.push({ arquivo: a, ok: false, erro: String(e.stderr || e.message).slice(0, 300) }); }
    }
  }
  try { await git(['diff', '--check']); saidas.push({ arquivo: 'git diff --check', ok: true }); }
  catch (e) { saidas.push({ arquivo: 'git diff --check', ok: false, erro: String(e.stderr || e.message).slice(0, 300) }); }
  return saidas;
}
async function commitEmerge(mensagem) {
  const sujo = await statusSujo();
  if (!sujo) return { commit: false, merge: false, motivo: 'sem alterações' };
  await git(['add', '-A']);
  await git(['commit', '-m', mensagem]);
  const atual = await branchAtual();
  if (atual !== BRANCH) return { commit: true, merge: false, motivo: 'fora da branch worker' };
  await git(['checkout', ALVO]);
  try {
    await git(['merge', '--ff-only', BRANCH]);
    return { commit: true, merge: true };
  } catch (e) {
    try { await git(['merge', '--abort']); } catch { /* nada a abortar */ }
    return { commit: true, merge: false, motivo: String(e.stderr || e.message).slice(0, 220) };
  }
}

async function patchDeterministico(ciclo, objetivo, plano) {
  const saude = relatorioSaude().slice(0, 5).map((r) => r.id + ':' + r.score).join(', ');
  const conteudo = '- ' + new Date().toISOString() + ' · ciclo ' + ciclo + ' · objetivo: ' + String(objetivo).slice(0, 160)
    + ' · plano: ' + (plano.passos || []).map((p) => p.acao).join('/')
    + ' · saúde: ' + (saude || 'sem dados');
  return { arquivo: 'docs/EVOLUCAO.md', modo: 'append', conteudo };
}

async function ciclo(n, objetivo, { autoMerge, intervaloMs, sinal }) {
  const inicio = Date.now();
  emitir('ciclo_inicio', { n, objetivo: objetivo.slice(0, 200) });
  try {
    const plano = await planejar(objetivo, { maxPassos: 4 }).catch(() => ({ passos: [], via: 'deterministico' }));
    emitir('plano', { n, via: plano.via, passos: (plano.passos || []).map((p) => p.acao + '→' + p.alvo) });

    await garantirBranch();
    emitir('branch', { n, branch: await branchAtual() });
    const limpos = await higienizar();
    emitir('higienizacao', { n, removidos: limpos });

    let patch = null, via = 'deterministico';
    try {
      const prompt = 'Você é o Myn Recicla, agente de código. Melhore este projeto: ' + objetivo
        + '\nResponda SOMENTE JSON: {"arquivo":"docs/EVOLUCAO.md","modo":"append","conteudo":"..."}'
        + '\nArquivos permitidos: docs/*.md, src/*.mjs, scripts/*.mjs, config/*.json. Sem texto fora do JSON.';
      const r = await Promise.race([
        respostaRapida(prompt, 9000),
        new Promise((_, rj) => setTimeout(() => rj(new Error('timeout')), 10000)),
      ]);
      if (r.ok) { patch = extrairJson(r.texto); via = r.via; }
    } catch (e) { emitir('modelo_falhou', { n, erro: String(e.message).slice(0, 120) }); }
    if (!validarPatch(patch)) { patch = await patchDeterministico(n, objetivo, plano); via = 'deterministico'; }
    emitir('patch', { n, arquivo: patch.arquivo, modo: patch.modo, via, bytes: patch.conteudo.length });

    const arquivo = await aplicarPatch(patch);
    const checagens = await checar([arquivo]);
    const ok = checagens.every((c) => c.ok);
    emitir('testes', { n, ok, checagens });
    if (!ok) {
      await git(['checkout', '--', arquivo]).catch(() => undefined);
      emitir('revertido', { n, arquivo });
      return { n, ok: false, motivo: 'testes falharam', ms: Date.now() - inicio };
    }
    const merge = autoMerge ? await commitEmerge('worker: ciclo ' + n + ' — ' + objetivo.slice(0, 80)) : { commit: false, merge: false, motivo: 'autoMerge desligado' };
    emitir('git', { n, ...merge });
    return { n, ok: true, merge: merge.merge === true, ms: Date.now() - inicio, arquivo };
  } catch (erro) {
    emitir('erro', { n, erro: String(erro.message).slice(0, 300) });
    return { n, ok: false, erro: String(erro.message).slice(0, 300), ms: Date.now() - inicio };
  }
}

/** Loop contínuo. Abortável. Emite eventos para os assinantes. */
export async function iniciar({ objetivo = 'melhorar o projeto Myn Recicla', maxCiclos = Infinity, intervaloMs = 4000, autoMerge = true } = {}) {
  if (ativo) return { ok: false, erro: 'worker já ativo' };
  ativo = true; abortar = false;
  estado = { ciclos: 0, ultimo: null, iniciadoEm: new Date().toISOString(), objetivo: String(objetivo).slice(0, 500) };
  emitir('iniciado', { objetivo: estado.objetivo, maxCiclos, intervaloMs, autoMerge });
  let n = 0;
  while (ativo && !abortar && n < maxCiclos) {
    n++;
    const r = await ciclo(n, estado.objetivo, { autoMerge, intervaloMs, sinal: { get abortado() { return abortar; } } });
    estado.ciclos = n;
    if (abortar) break;
    await new Promise((resolve) => setTimeout(resolve, Math.max(500, intervaloMs)));
  }
  ativo = false;
  emitir('finalizado', { ciclos: n, motivo: abortar ? 'parado' : 'limite' });
  return { ok: true, ciclos: n };
}
export function parar() { if (!ativo) return { ok: false, erro: 'worker não estava ativo' }; abortar = true; emitir('parando', {}); return { ok: true }; }
