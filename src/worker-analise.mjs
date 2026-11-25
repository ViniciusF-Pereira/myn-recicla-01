/** Worker de ANÁLISE: observa o projeto, mede saúde/código e emite achados. Nunca edita nem commita. */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { relatorio } from './saude.mjs';
import { analisarMelhorias } from './analise.mjs';
import { carregarPlugins } from './plugins.mjs';
import { medirDesempenho } from './desempenho.mjs';

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

async function varrer() {
  const arquivos = [];
  for (const dir of ['src', 'scripts', 'web']) {
    let ns = [];
    try { ns = await readdir(path.join(RAIZ, dir)); } catch { continue; }
    for (const nome of ns.filter((n) => n.endsWith('.mjs') || n.endsWith('.js'))) {
      const p = path.join(RAIZ, dir, nome);
      try {
        const texto = await readFile(p, 'utf8');
        const linhas = texto.split(/\r?\n/);
        arquivos.push({
          arquivo: dir + '/' + nome,
          linhas: linhas.length,
          exports: (texto.match(/export\s+(?:async\s+)?function\s+(\w+)/g) || []).length,
          todos: (texto.match(/TODO|FIXME|HACK/g) || []).length,
          async: (texto.match(/async\s/g) || []).length,
        });
      } catch { /* pula */ }
    }
  }
  return arquivos;
}

async function ciclo(n, objetivo) {
  emitir('analise_inicio', { n, objetivo: objetivo.slice(0, 200) });
  const arquivos = await varrer();
  const saude = relatorio().slice(0, 8);
  const listaSaude = relatorio();
  const media = listaSaude.length ? listaSaude.reduce((n, x) => n + x.score, 0) / listaSaude.length : 0;
  const backlog = await analisarMelhorias();
  let plugins = 0, desempenho = null;
  try {
    [plugins, desempenho] = await Promise.all([
      carregarPlugins().then((p) => p.length).catch(() => 0),
      medirDesempenho('http://127.0.0.1:5188', 2),
    ]);
  } catch { /* métricas opcionais */ }
  const achados = [];
  if (media < 0.7) achados.push('saude media baixa: ' + media);
  if (arquivos.some((a) => a.todos > 0)) achados.push('marcadores TODO/FIXME presentes');
  if (backlog.analise?.pendentes) achados.push(backlog.analise.pendentes + ' melhorias pendentes');
  if (desempenho?.gargalos?.length) achados.push('gargalos de desempenho: ' + desempenho.gargalos.join(', '));
  const piorMs = desempenho ? Math.max(...desempenho.medidas.map((m) => m.p50Ms || 0)) : 0;
  const assinatura = arquivos.map((a) => a.arquivo + ':' + a.linhas + ':' + a.todos).join('|')
    + '|perf:' + (desempenho?.totalKb ?? '?') + ':' + piorMs;
  const mudou = assinatura !== estado.ultimaAssinatura;
  estado.ultimaAssinatura = assinatura;
  emitir('arquivos', { n, total: arquivos.length, mudou, maiores: arquivos.sort((a, b) => b.linhas - a.linhas).slice(0, 5) });
  emitir('saude', { n, media, rotas: saude });
  emitir('backlog', { n, ...(backlog.analise || {}) });
  if (desempenho) emitir('desempenho', { n, totalKb: desempenho.totalKb, piorMs: Math.round(piorMs), gargalos: desempenho.gargalos, medidas: desempenho.medidas });
  emitir('achados', { n, achados, plugins });
  emitir('analise_fim', { n, mudou, score: Math.round((media * 0.5 + Math.max(0, 1 - achados.length / 5) * 0.5) * 100) / 100 });
  return { mudou, achados };
}

export async function iniciar({ objetivo = 'analisar codigo e desempenho do Myn Recicla', maxCiclos = Infinity, intervaloMs = 8000 } = {}) {
  if (ativo) return { ok: false, erro: 'worker de analise ja ativo' };
  ativo = true; abortar = false;
  estado = { ciclos: 0, ultimo: null, ultimaAssinatura: '', iniciadoEm: new Date().toISOString(), objetivo: String(objetivo).slice(0, 500) };
  emitir('iniciado', { objetivo: estado.objetivo, intervaloMs });
  let n = 0;
  while (ativo && !abortar && n < maxCiclos) {
    n++; estado.ciclos = n;
    const r = await ciclo(n, estado.objetivo);
    if (r && r.mudou === false) emitir('inalterado', { n, aviso: 'nenhuma mudança; continuando em observação' });
    if (abortar) break;
    await new Promise((r) => setTimeout(r, Math.max(1000, intervaloMs)));
  }
  ativo = false;
  emitir('finalizado', { ciclos: n, motivo: abortar ? 'parado' : 'limite' });
  return { ok: true, ciclos: n };
}
export function parar() { if (!ativo) return { ok: false, erro: 'worker de analise nao estava ativo' }; abortar = true; emitir('parando', {}); return { ok: true }; }
