/** Orquestração por capacidade: classifica a tarefa, escolhe rotas saudáveis e roda em paralelo. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { escolherRotas, registrar } from './saude.mjs';
import { executarPlugin } from './plugins.mjs';

const RAIZ = process.cwd();
const REGRAS = [
  ['codigo', /\b(codigo|código|code|program|script|bug|refator|typescript|javascript|python|api)\b/i],
  ['pesquisa', /\b(pesquisa|pesquisar|search|busca|buscar|fontes|citacoes|citações|research|noticias|notícias)\b/i],
  ['imagem', /\b(imagem|image|foto|desenho|draw|ilustra|gerar imagem)\b/i],
  ['video', /\b(video|vídeo|clipe|animar|animação)\b/i],
  ['voz', /\b(voz|audio|áudio|narra|tts|falar)\b/i],
  ['documento', /\b(documento|pdf|planilha|csv|xlsx|docx|arquivo)\b/i],
  ['raciocinio', /\b(raciocínio|raciocinio|analise|análise|comparar|explicar|por que|porque)\b/i],
  ['longo', /\b(longo|longa|contexto|livro|relatorio|relatório|resumo extenso)\b/i],
  ['visao', /\b(visão|visao|imagem|screenshot|tela|ui)\b/i],
  ['rapido', /\b(rapido|rápido|rápida|svg|ok|oi|curto)\b/i],
];

export function classificarTarefa(texto) {
  const s = String(texto || '');
  const caps = REGRAS.filter(([, re]) => re.test(s)).map(([cap]) => cap);
  return caps.length ? caps : ['chat'];
}

export async function carregarMapaModelos() {
  return JSON.parse(await readFile(path.join(RAIZ, 'config/modelos.json'), 'utf8')).rotas;
}

/** Rotas que atendem às capacidades, já ordenadas pelo scoreboard (circuitos abertos ficam por último). */
export async function escolherPara(tarefa, max = 3, rapido = false) {
  const caps = classificarTarefa(tarefa);
  const mapa = (await carregarMapaModelos()).filter((r) => !/google|gemini/i.test(r.id + ' ' + r.nome + ' ' + r.modelo));
  const plugins = JSON.parse(await readFile(path.join(RAIZ, 'config/plugins.json'), 'utf8')).plugins
    .filter((p) => p.acao !== 'local' && !/google|gemini/i.test(p.id + ' ' + p.nome));
  const idsDisponiveis = new Set(plugins.map((p) => p.id));
  let candidatos = mapa.filter((r) => idsDisponiveis.has(r.id) && r.capacidades.some((c) => caps.includes(c)) && !r.confirmacao);
  if (rapido) {
    // Web-only: NUNCA usar geradores locais (PIL/ffmpeg/edge-tts). Somente APIs online free.
    const ids = new Set(plugins.filter((p) => p.acao === 'api').map((p) => p.id));
    const rapidos = mapa.filter((r) => ids.has(r.id) && !r.confirmacao && r.capacidades.some((c) => caps.includes(c)));
    const casados = candidatos.filter((r) => ids.has(r.id));
    candidatos = casados.length >= 2 ? casados : [...casados, ...rapidos.filter((r) => !casados.includes(r))];
  }
  const saudaveis = escolherRotas(candidatos.map((r) => r.id));
  const ordem = new Map(saudaveis.map((id, i) => [id, i]));
  return candidatos.sort((a, b) => (ordem.get(a.id) ?? 999) - (ordem.get(b.id) ?? 999)).slice(0, max).map((r) => ({ ...r, capacidadesMatch: r.capacidades.filter((c) => caps.includes(c)) }));
}

function avaliar(texto) {
  const s = String(texto || '').trim();
  const penalidade = /não consegui|nao consegui|sem resposta|erro|sorry|can't help|não entendi/i.test(s);
  const tamanho = Math.min(1, s.length / 400);
  const tempo = /rapido|rápido/.test(s) ? 0.1 : 0;
  return Math.max(0, (penalidade ? 0 : 0.7) + tamanho * 0.3 - tempo);
}

/** Roda as rotas em paralelo com Promise.all e escolhe a melhor resposta. */
export async function orquestrar({ tarefa, gateway, trava, plugins, max = 3, rapido = false, log = () => {} }) {
  const inicio = Date.now();
  const rotas = await escolherPara(tarefa, max, rapido);
  log({ etapa: 'classificar', capacidades: classificarTarefa(tarefa), rotas: rotas.map((r) => r.id) });
  const promessas = rotas.map(async (rota) => {
    const t = Date.now();
    const plugin = plugins.find((p) => p.id === rota.id);
    if (!plugin) return { rota: rota.id, ok: false, erro: 'plugin ausente', nota: 0, ms: 0 };
    const d = await executarPlugin({ plugin, entrada: tarefa, gateway, trava, log: (x) => log({ rota: rota.id, ...x }) });
    registrar(rota.id, { ok: d.ok, ms: d.ms, erro: d.erro || (d.ok ? '' : 'sem_resposta') });
    const texto = d.ok ? d.resposta : (d.erro || '');
    return { rota: rota.id, nome: rota.nome, modelo: rota.modelo, ok: d.ok, resposta: texto, nota: avaliar(texto), ms: Date.now() - t };
  });
  const resultados = await Promise.all(promessas);
  const sucessos = resultados.filter((r) => r.ok && String(r.resposta || '').trim());
  if (!sucessos.length) {
    const deterministico = { rota: 'deterministico', nome: 'Plano base (sem rede)', ok: true,
      resposta: 'APIs online indisponíveis. Plano determinístico: ' + classificarTarefa(tarefa).join(', '), nota: 0.5, ms: 0 };
    return { tarefa, capacidades: classificarTarefa(tarefa), ms: Date.now() - inicio, vencedor: deterministico, resultados: [...resultados, deterministico], via: 'deterministico' };
  }
  const vencedor = [...sucessos].sort((a, b) => b.nota - a.nota)[0] || null;
  return { tarefa, capacidades: classificarTarefa(tarefa), ms: Date.now() - inicio, vencedor, resultados };
}
