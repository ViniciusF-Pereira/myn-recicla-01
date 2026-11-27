/** Avaliação objetiva de respostas do agente por capacidade, identidade e latência. */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { executarAgente } from './nucleo.mjs';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
const ARQUIVO = path.join(DADOS, 'avaliacao-qualidade.jsonl');

export function avaliarResposta({ tarefa, resposta, capacidades = [], latenciaMs = 0 }) {
  const texto = String(resposta || '').trim();
  const criterios = {}, problemas = [];
  let nota = 0;
  const add = (nome, valor, max, motivo) => { criterios[nome] = Math.round(Math.max(0, Math.min(max, valor)) * 100) / 100; nota += criterios[nome]; if (motivo) problemas.push(motivo); };

  add('resposta', texto.length >= 20 ? 0.25 : texto ? 0.08 : 0, 0.25, texto.length < 20 ? 'resposta curta demais' : '');
  add('identidade', /chatgpt|claude|gemini|google/i.test(texto) ? 0 : 0.2, 0.2, /chatgpt|claude|gemini|google/i.test(texto) ? 'identidade de outro produto' : '');
  add('recusa', /não consegui|nao consegui|sem resposta|não entendi|nao entendi/i.test(texto) ? 0 : 0.15, 0.15, /não consegui|nao consegui|sem resposta|não entendi|nao entendi/i.test(texto) ? 'recusa ou falha' : '');
  if (capacidades.includes('codigo')) add('codigo', /```|\bfunction\b|\bconst\b|\bclass\b/.test(texto) ? 0.2 : 0, 0.2, /```|\bfunction\b|\bconst\b|\bclass\b/.test(texto) ? '' : 'tarefa de código sem código');
  else add('codigo', 0.1, 0.1);
  if (capacidades.includes('pesquisa')) add('fontes', /https?:\/\/|\[FONTE:|docs\//i.test(texto) ? 0.1 : 0, 0.1, /https?:\/\/|\[FONTE:|docs\//i.test(texto) ? '' : 'pesquisa sem fonte');
  else add('fontes', 0.05, 0.05);
  add('latencia', latenciaMs <= 15000 ? 0.05 : latenciaMs <= 60000 ? 0.025 : 0, 0.05, latenciaMs > 60000 ? 'latência alta' : '');
  return { nota: Math.round(nota * 100) / 100, aprovado: nota >= 0.7 && problemas.length === 0, criterios, problemas, tarefa, latenciaMs };
}

const CASOS = [
  { id: 'identidade', tarefa: 'Quem é você?', esperado: 'Myn Recicla/01', capacidades: ['chat'] },
  { id: 'documentacao', tarefa: 'Como você funciona?', esperado: 'Playground', capacidades: ['chat'] },
  { id: 'codigo', tarefa: 'Escreva uma função JavaScript que some dois números.', esperado: 'function', capacidades: ['codigo'] },
  { id: 'pesquisa', tarefa: 'Pesquise sobre os workers do projeto.', esperado: 'WORKER_INFINITO', capacidades: ['pesquisa'] },
];

export async function executarCaso(caso, deps = {}) {
  const inicio = Date.now();
  const r = deps.executar ? await deps.executar({ mensagem: caso.tarefa, sessao: 'avaliacao-' + caso.id, canal: 'avaliacao' }) : await executarAgente({ mensagem: caso.tarefa, sessao: 'avaliacao-' + caso.id, canal: 'avaliacao' });
  const latenciaMs = Date.now() - inicio;
  const esperadoOk = String(r.resposta).toLowerCase().includes(caso.esperado.toLowerCase());
  const qualidade = avaliarResposta({ tarefa: caso.tarefa, resposta: r.resposta, capacidades: caso.capacidades, latenciaMs });
  return { id: caso.id, esperadoOk, ...qualidade, via: r.via, passos: r.passos };
}

export async function rodarAvaliacao(deps = {}) {
  await mkdir(DADOS, { recursive: true });
  const resultados = [];
  for (const caso of CASOS) resultados.push(await executarCaso(caso, deps));
  const relatorio = { t: new Date().toISOString(), resultados, aprovados: resultados.filter((r) => r.aprovado && r.esperadoOk).length, total: resultados.length };
  await appendFile(ARQUIVO, JSON.stringify(relatorio) + '\n');
  return relatorio;
}

export async function ultimaAvaliacao() {
  try {
    const linhas = (await readFile(ARQUIVO, 'utf8')).trim().split(/\r?\n/).filter(Boolean);
    return linhas.length ? JSON.parse(linhas.at(-1)) : null;
  } catch { return null; }
}
