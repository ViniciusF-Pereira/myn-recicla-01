/** Respostas determinísticas sobre o próprio produto, sem depender de cota de modelo. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let cache = null;

async function numeros() {
  if (cache) return cache;
  try {
    const [plugins, modelos] = await Promise.all([
      readFile(path.join(RAIZ, 'config/plugins.json'), 'utf8').then(JSON.parse),
      readFile(path.join(RAIZ, 'config/modelos-descobertos.json'), 'utf8').then(JSON.parse).catch(() => ({ total: 0 })),
    ]);
    cache = { rotas: plugins.plugins?.length || 0, modelos: modelos.total || 0 };
  } catch { cache = { rotas: 0, modelos: 0 }; }
  return cache;
}

export async function respostaLocal(pergunta) {
  const p = String(pergunta || '').toLowerCase();
  if (!p) return null;
  const n = await numeros();

  if (/quem (é|e) (você|voce|o myn)|sobre o myn|o que (é|e) o myn|resumo.{0,30}myn|myn recicla/i.test(p)) {
    return 'Sou o **Myn Recicla/01**, um produto open-source browser-only que transforma abas de chat gratuitas em rotas de agente. Tenho Playground, workers de análise e melhoria, MCP, descoberta de modelos livres, RAG local e funcionamento sem chaves de API.';
  }
  if (/documenta|docs|manual|guia|onde (leio|acho)|ajuda|como (você|voce|myn) (funciona|usa)|o que (você|voce|myn) (sabe|faz)/i.test(p)) {
    return `**Como usar o Myn Recicla/01**\n\n1. Abra a home e clique em **ABRIR PLAYGROUND /01**.\n2. Escolha uma rota ou use **auto**.\n3. Escreva, anexe documentos/imagens e envie.\n4. Use **worker** para ver análise e melhoria ao vivo.\n5. Use o **WORK**, o assistente flutuante com MCP e voz.\n\nDocumentação principal: \`README.md\`, \`docs/GUIA_RAPIDO.md\`, \`docs/WORKER_INFINITO.md\`, \`docs/ASSISTENTE_WORK.md\` e \`docs/API.md\`.\n\nHoje o catálogo tem **${n.rotas} rotas** e **${n.modelos} modelos descobertos**.`;
  }
  if (/quem (criou|desenvolveu)|autor|created by|vinicius/i.test(p)) {
    return 'O Myn Recicla/01 foi criado por **Vinicius de Freitas Pereira**. Os links de GitHub, LinkedIn e Myncellium estão na seção **06 · Created By** da home.';
  }
  if (/worker|workers|melhoria|análise|analise|autônomo|autonomo/i.test(p)) {
    return 'Os workers funcionam em duas frentes: **análise** mede código, desempenho, modelos e arquitetura; **melhoria** aplica achados concretos, roda testes, faz smoke e merge automático guardado. Quando não existe achado real, a melhoria fica vigiando em vez de inventar commits.';
  }
  if (/mcp|ferramenta|tool/i.test(p)) {
    return 'O MCP expõe 10 ferramentas: chat, pesquisa, rotas, plugin, imagem, áudio, vídeo, documento, histórico e mensagem. O WORK mostra a ferramenta em uso e permite cancelar a chamada.';
  }
  if (/modelo|modelos|ollama|webgpu/i.test(p)) {
    return `O catálogo possui **${n.modelos} modelos descobertos** por fontes públicas: Pollinations, OpenRouter e HuggingFace. A execução depende da rota escolhida e pode ter cota comunitária; Google/Gemini não são usados.`;
  }
  return null;
}
