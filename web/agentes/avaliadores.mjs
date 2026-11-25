/** Agentes que avaliam código, desempenho e inteligência usando rotas free + WebGPU local. */
import { orquestrar } from '../core/orquestrador.mjs';
import { capacidade } from '../inferencia/embeddings-gpu.mjs';
import { inserir } from '../db/leve.mjs';

export const AGENTES = [
  { id: 'auditor', nome: 'Auditor', foco: 'correção e segurança', prompt: 'Revise este código e aponte 3 problemas reais de correção ou segurança.' },
  { id: 'performance', nome: 'Desempenho', foco: 'velocidade e memória', prompt: 'Analise este código e aponte 3 melhorias concretas de desempenho.' },
  { id: 'inteligencia', nome: 'Inteligência', foco: 'clareza e arquitetura', prompt: 'Avalie a clareza e a arquitetura deste código; sugira 3 melhorias.' },
];

export async function avaliar(codigo, agente, rota = 'auto') {
  const a = AGENTES.find((x) => x.id === agente) || AGENTES[0];
  const inicio = Date.now();
  let via = 'webgpu-local', texto = '';
  try {
    if (window.myn?.llm?.disponivel()) {
      texto = await window.myn.llm.responder(a.prompt + '\n\n' + String(codigo).slice(0, 2500));
    } else {
      const r = await orquestrar({ tarefa: a.prompt + '\n' + String(codigo).slice(0, 1200), max: 1, rapido: true });
      texto = String(r.vencedor?.resposta || 'Sem resposta das rotas free');
      via = 'rota:' + (r.vencedor?.rota || 'nenhuma');
    }
  } catch (e) { texto = 'Falha: ' + e.message; via = 'erro'; }
  const registro = { agente: a.id, foco: a.foco, via, ms: Date.now() - inicio, texto: String(texto).slice(0, 4000) };
  await inserir('metricas', { chave: 'avaliacao:' + a.id, ...registro });
  return registro;
}

export async function avaliarTodos(codigo) {
  const gpu = capacidade();
  // Paralelismo real dentro do Myn: três agentes ao mesmo tempo.
  const resultados = await Promise.all(AGENTES.map((a) => avaliar(codigo, a.id)));
  const tarefas = resultados.map((r) => ({
    id: 'agente-' + r.agente + '-' + Date.now().toString(36),
    titulo: 'achado do agente ' + r.agente + ': ' + r.texto.slice(0, 90),
    agente: r.agente,
    texto: r.texto,
    via: r.via,
  }));
  for (const t of tarefas) await inserir('metricas', { chave: 'tarefa:' + t.id, ...t });
  return { gpu, resultados, tarefas };
}
