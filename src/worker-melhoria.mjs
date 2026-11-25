/** Worker de MELHORIA: achado concreto → patch mínimo → testes → commit → merge automático guardado. */
import { readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { analisarMelhorias, marcar } from './analise.mjs';
import { auditarCodigo, reproduzirAchado } from './auditoria-codigo.mjs';

const run = promisify(execFile);
const RAIZ = process.cwd();
const AUTO_MERGE_CODIGO = process.env.MYN_AUTO_MERGE_CODIGO !== '0';
let ativo = false, abortar = false;
const inscritos = new Set();
let estado = { ciclos: 0, ultimo: null, iniciadoEm: null, objetivo: null };

function emitir(tipo, dados = {}) {
  const ev = { t: new Date().toISOString(), tipo, ...dados };
  for (const fn of inscritos) { try { fn(ev); } catch { /* morto */ } }
  estado.ultimo = ev;
}
export function assinar(fn) { inscritos.add(fn); return () => inscritos.delete(fn); }
export function status() { return { ativo, autoMergeCodigo: AUTO_MERGE_CODIGO, ...estado, inscritos: inscritos.size }; }
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

async function aplicarAchado(f) {
  const destino = path.join(RAIZ, f.arquivo);
  let codigo = await readFile(destino, 'utf8');
  for (const c of f.correcao) {
    const i = codigo.indexOf(c.antigo);
    if (i < 0 || codigo.indexOf(c.antigo, i + 1) >= 0) throw new Error('trecho do achado não é único/exato');
    codigo = codigo.slice(0, i) + c.novo + codigo.slice(i + c.antigo.length);
  }
  await writeFile(destino, codigo, 'utf8');
  return f.arquivo;
}

async function temTestes() {
  for (const dir of ['test', 'tests', '__tests__']) {
    try { if ((await readdir(path.join(RAIZ, dir))).length) return true; } catch { /* não existe */ }
  }
  try { return (await readdir(path.join(RAIZ, 'scripts'))).some((n) => /\.(test|spec)\.(mjs|js)$/.test(n)); }
  catch { return false; }
}

async function verificar(arquivo) {
  const checagens = [];
  if (await temTestes()) {
    try { await run(process.execPath, ['--test'], { cwd: RAIZ, timeout: 60000 }); checagens.push({ arquivo: 'node --test', ok: true }); }
    catch (e) { checagens.push({ arquivo: 'node --test', ok: false, erro: String(e.stdout || e.stderr || e.message).trim().slice(0, 240) }); }
  } else checagens.push({ arquivo: 'sem testes no projeto', ok: true, nota: 'sintaxe + diff check' });
  if (/\.(mjs|js|cjs)$/.test(arquivo)) {
    try { await run(process.execPath, ['--check', path.join(RAIZ, arquivo)]); checagens.push({ arquivo, ok: true }); }
    catch (e) { checagens.push({ arquivo, ok: false, erro: String(e.stderr || e.message).slice(0, 240) }); }
  } else checagens.push({ arquivo, ok: true, nota: 'documento/config' });
  try { await git(['diff', '--check']); checagens.push({ arquivo: 'git diff --check', ok: true }); }
  catch (e) { checagens.push({ arquivo: 'git diff --check', ok: false, erro: String(e.stdout || e.stderr || e.message).trim().slice(0, 240) }); }
  return checagens;
}

export function caminhoPermitido(caminho, permitirCodigo) {
  if (caminho.split(/[\\/]/).includes('..')) return false;
  if (/^(docs|config)\//.test(caminho)) return true;
  if (!permitirCodigo) return false;
  return /^(src|scripts|tests|web|site)\//.test(caminho)
    || /^(Dockerfile|docker-compose\.yml|package\.json)$/.test(caminho);
}

async function mesclarBranch(n, permitirCodigo = AUTO_MERGE_CODIGO) {
  const diff = await git(['diff', '--name-only', 'master...worker/auto']);
  const arquivos = diff.split(/\r?\n/).filter(Boolean);
  if (!arquivos.length) return false;
  const proibidos = arquivos.filter((f) => !caminhoPermitido(f, permitirCodigo));
  if (proibidos.length) {
    emitir('merge_bloqueado', { n, arquivos: proibidos, aviso: 'caminho fora da allowlist ou merge de código desativado' });
    return false;
  }
  await git(['checkout', 'master']);
  try { await git(['merge', '--ff-only', 'worker/auto']); return true; }
  catch { await git(['merge', '--abort']).catch(() => undefined); return false; }
}

async function reverter(arquivo, existia) {
  if (existia) await git(['checkout', '--', arquivo]).catch(() => undefined);
  else await unlink(path.join(RAIZ, arquivo)).catch(() => undefined);
}

async function cicloAuditoria(n) {
  const auditoria = await auditarCodigo();
  emitir('auditoria_codigo', { n, ...auditoria.resumo });
  if (!auditoria.achados.length) {
    emitir('aguardando', { n, aviso: 'nenhum achado concreto de código/infra' });
    return { n, semTarefas: true };
  }
  const f = auditoria.achados[0];
  const reproduzido = Boolean(await f.teste());
  emitir('achado', { n, id: f.id, arquivo: f.arquivo, categoria: f.categoria, descricao: f.descricao, reproduzido, deterministico: Boolean(f.correcao) });
  if (!f.correcao) {
    emitir('llm_necessario', { n, id: f.id, aviso: 'achado sem patch determinístico; nenhum envio externo feito' });
    return { n, semTarefas: true };
  }
  await garantirBranch();
  const existia = await readFile(path.join(RAIZ, f.arquivo), 'utf8').then(() => true).catch(() => false);
  let aplicado = false;
  try {
    emitir('patch', { n, id: f.id, titulo: f.descricao, arquivo: f.arquivo, via: 'auditoria-local' });
    const arquivo = await aplicarAchado(f);
    aplicado = true;
    const aindaReproduz = await reproduzirAchado(f.id);
    const checagens = await verificar(arquivo);
    const ok = !aindaReproduz && checagens.every((c) => c.ok);
    emitir('testes', { n, ok, checagens, achado: f.id, aindaReproduz });
    if (!ok) {
      await reverter(arquivo, existia);
      emitir('revertido', { n, arquivo, tarefa: f.id });
      return { n, ok: false, tarefa: f.id };
    }
    await git(['add', '--', arquivo]);
    const pendente = await git(['status', '--porcelain', '--', arquivo]);
    let merge = false;
    if (pendente) {
      await git(['commit', '-m', 'engenharia: ' + f.id + ' (auditoria local)', '--', arquivo]);
      merge = await mesclarBranch(n, AUTO_MERGE_CODIGO);
    }
    emitir('engenharia_aplicada', { n, id: f.id, arquivo, merge, revisaoHumana: !merge });
    return { n, ok: true, merge, tarefa: f.id };
  } catch (e) {
    if (aplicado) await reverter(f.arquivo, existia);
    emitir('engenharia_erro', { n, id: f.id, erro: String(e.message).slice(0, 240) });
    return { n, ok: false, tarefa: f.id };
  }
}

async function cicloBacklog(n, t) {
  await garantirBranch();
  emitir('branch', { n, branch: await git(['rev-parse', '--abbrev-ref', 'HEAD']) });
  const existia = await readFile(path.join(RAIZ, t.alvo), 'utf8').then(() => true).catch(() => false);
  emitir('patch', { n, id: t.id, titulo: t.titulo, arquivo: t.alvo, via: 'analise-local' });
  const arquivo = await aplicar(t);
  const checagens = await verificar(arquivo);
  const ok = checagens.every((c) => c.ok);
  emitir('testes', { n, ok, checagens });
  if (!ok) {
    await reverter(arquivo, existia);
    emitir('revertido', { n, arquivo, tarefa: t.id });
    return { n, ok: false, tarefa: t.id };
  }
  await marcar(t.id);
  await git(['add', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']).catch(() => undefined);
  const pendente = await git(['status', '--porcelain', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']);
  let merge = false;
  if (pendente) {
    await git(['commit', '-m', 'worker: ' + t.titulo + ' (ciclo ' + n + ')', '--', arquivo, 'docs/MELHORIAS_APLICADAS.json']);
    merge = await mesclarBranch(n, AUTO_MERGE_CODIGO);
    if (!merge && !/^(docs|config)\//.test(t.alvo)) emitir('revisao', { n, arquivo: t.alvo, aviso: AUTO_MERGE_CODIGO ? 'merge bloqueado por allowlist/conflito' : 'MYN_AUTO_MERGE_CODIGO=0' });
  } else emitir('sem_alteracao', { n, arquivo });
  emitir('git', { n, merge, tarefa: t.id });
  return { n, ok: true, merge, tarefa: t.id };
}

async function ciclo(n, objetivo) {
  emitir('ciclo_inicio', { n, objetivo: objetivo.slice(0, 200) });
  const analise = await analisarMelhorias();
  emitir('analise', { n, ...analise.analise });
  return analise.tarefa ? cicloBacklog(n, analise.tarefa) : cicloAuditoria(n);
}

export async function iniciar({ objetivo = 'melhorar codigo, infra, modelos e arquitetura', maxCiclos = 1000, intervaloMs = 4000 } = {}) {
  if (ativo) return { ok: false, erro: 'worker de melhoria ja ativo' };
  ativo = true; abortar = false;
  estado = { ciclos: 0, ultimo: null, iniciadoEm: new Date().toISOString(), objetivo: String(objetivo).slice(0, 500) };
  emitir('iniciado', { objetivo: estado.objetivo, autoMergeCodigo: AUTO_MERGE_CODIGO, modo: 'achado-concreto' });
  let n = 0, motivo = 'limite', falhou = null, falhas = 0;
  while (ativo && !abortar && n < maxCiclos) {
    n++; estado.ciclos = n;
    const r = await ciclo(n, estado.objetivo);
    if (abortar) { motivo = 'parado'; break; }
    if (r.ok === false) {
      if (r.tarefa === falhou) falhas++; else { falhou = r.tarefa; falhas = 1; }
      if (falhas >= 2) { emitir('bloqueado', { tarefa: falhou, aviso: 'tarefa falhou 2x; parando para revisão técnica' }); motivo = 'tarefa bloqueada'; break; }
    } else falhou = null;
    await new Promise((r2) => setTimeout(r2, Math.max(500, intervaloMs)));
  }
  ativo = false;
  emitir('finalizado', { ciclos: n, motivo });
  return { ok: true, ciclos: n, motivo };
}
export function parar() { if (!ativo) return { ok: false, erro: 'worker de melhoria nao estava ativo' }; abortar = true; emitir('parando', {}); return { ok: true }; }
