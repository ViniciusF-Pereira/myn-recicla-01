/** Myn Web — API pública no navegador. Sem Node, sem binário, sem PC local. */
import * as orq from '../web/core/orquestrador.mjs';
import * as ragStore from '../web/rag/store.mjs';
import * as gpu from '../web/inferencia/embeddings-gpu.mjs';
import * as llm from '../web/inferencia/llm-gpu.mjs';
import { reparar } from '../web/tools/reparo.mjs';
import * as goal from '../web/core/agendador.mjs';
import { escrever, ler, listar, baixar, executar } from '../web/tools/executor.mjs';
import * as db from '../web/db/leve.mjs';
import { VMWeb } from '../web/vm/vm.mjs';
import { avaliar, avaliarTodos, AGENTES } from '../web/agentes/avaliadores.mjs';
import * as sessao from './sessao.mjs';

async function semear() {
  try {
    const [plugins, saude] = await Promise.all([
      fetch('/api/plugins').then((r) => r.json()),
      fetch('/api/saude').then((r) => r.json()),
    ]);
    const docs = [
      { id: 'plugins', titulo: 'Catálogo de plugins', texto: (plugins.plugins || []).map((p) => p.nome + ' ' + p.categoria + ' ' + p.limite).join('\n') },
      { id: 'saude', titulo: 'Saúde das rotas', texto: (saude.rotas || []).map((r) => r.id + ' score ' + r.score + ' ' + r.circuito).join('\n') },
      { id: 'myn', titulo: 'Myn Recicla', texto: 'Myn Recicla/01: agente web-only sobre rotas gratuitas de navegador e WebGPU. Sem chave, sem serviço pago, sem execução local.' },
    ];
    await ragStore.indexar(docs);
  } catch { /* RAG segue vazio até a API voltar */ }
}

window.myn = {
  versao: 'web-only-1',
  capacidade: gpu.capacidade(),
  orquestrar: orq.orquestrar,
  plano: orq.plano,
  stream: orq.stream,
  executarPasso: orq.executarPasso,
  saude: () => orq.saude.relatorio(),
  rag: (q, n) => ragStore.buscar(q, n),
  reparar,
  tools: { escrever, ler, listar, baixar, executar },
  goal: { criar: goal.criar, listar: goal.listar, cancelar: goal.cancelar, rodar: goal.rodar, retomar: goal.retomar },
  embeddings: gpu.embeddings,
  llm: { disponivel: llm.disponivel, responder: llm.responder, info: llm.info },
  db,
  vm: { criar: (nome) => new VMWeb(nome), padrao: null },
  agentes: { lista: AGENTES, avaliar, avaliarTodos },
  sessao: { carregar: sessao.carregar, salvar: sessao.salvar, markdown: sessao.markdown },
  pronto: (async () => { await semear(); await goal.retomar(); window.myn.vm.padrao = await new VMWeb('myn-vm-padrao').iniciar(); })(),
};
document.documentElement.dataset.myn = 'pronto';
