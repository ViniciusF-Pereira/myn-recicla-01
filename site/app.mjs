/** Myn Web — API pública no navegador. Sem Node, sem binário, sem PC local. */
import * as orq from '../web/core/orquestrador.mjs';
import * as ragStore from '../web/rag/store.mjs';
import * as gpu from '../web/inferencia/embeddings-gpu.mjs';
import { reparar } from '../web/tools/reparo.mjs';
import { escrever, ler, listar, baixar, executar } from '../web/tools/executor.mjs';

async function semear() {
  try {
    const [plugins, saude] = await Promise.all([
      fetch('/api/plugins').then((r) => r.json()),
      fetch('/api/saude').then((r) => r.json()),
    ]);
    const docs = [
      { id: 'plugins', titulo: 'Catálogo de plugins', texto: (plugins.plugins || []).map((p) => p.nome + ' ' + p.categoria + ' ' + p.limite).join('\n') },
      { id: 'saude', titulo: 'Saúde das rotas', texto: (saude.rotas || []).map((r) => r.id + ' score ' + r.score + ' ' + r.circuito).join('\n') },
      { id: 'myn', titulo: 'Myn Recyla', texto: 'Myn Recyla/01: agente web-only sobre rotas gratuitas de navegador e WebGPU. Sem chave, sem serviço pago, sem execução local.' },
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
  embeddings: gpu.embeddings,
  pronto: semear(),
};
document.documentElement.dataset.myn = 'pronto';
