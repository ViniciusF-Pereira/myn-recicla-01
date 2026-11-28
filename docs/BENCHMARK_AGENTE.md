# Benchmark do agente Myn

Data: 28/11/2026. Objetivo: superar um chat genérico em **tool-use, artefatos, fontes, cancelamento, velocidade percebida e custo verificável**. Não há acesso pago ao ChatGPT nesta execução; portanto estes números são baseline do Myn, não uma medição direta de paridade.

## Resultado executado

Com o servidor local em execução, use `npm run benchmark` (ou `node scripts/benchmark-agente.mjs`). Relatório: `outputs/benchmark-agente.json`.

| Critério | Resultado |
|---|---|
| Roteamento de intenção | **6/6** casos corretos |
| SSE semântico | `response.created`, `tool.start`, `tool.end`, `response.in_progress`, `response.output_text.delta`, `response.completed` |
| Primeiro token — identidade local | **21 ms de mediana**; 11–212 ms nas 3 rodadas |
| Primeiro token — pesquisa local | **13 ms de mediana**; 13–174 ms nas 3 rodadas |
| Verificações automáticas | **6/6** execuções SSE aprovadas |
| Pesquisa com fontes | **4 fontes** e **4 ferramentas** consideradas |
| Cancelamento | Validado no navegador; botão restaurado após abort |
| Reconexão SSE | Rota automática: 2 tentativas, resposta na segunda; rota explícita: 1 tentativa, sem repetição |
| Planilha | CSV local, preview e download, sem gateway |
| Custo pago | **0** |

Os números acima são desta máquina, com servidor local e respostas determinísticas do próprio produto. A primeira rodada de cada caso inclui aquecimento do processo; por isso a faixa é mais informativa que um valor isolado. O servidor pré-aquece o índice RAG antes de aceitar conexões.

## Referência de produto pesquisada

Documentação oficial consultada em 28/11/2026:

- Streaming por SSE com eventos tipados: https://platform.openai.com/docs/guides/streaming-responses
- Function calling, progresso de argumentos e recomendações de tool search: https://platform.openai.com/docs/guides/function-calling
- Projects com arquivos, instruções, memória, Canvas, imagem, voz e pesquisa: https://help.openai.com/en/articles/10169521-projects-in-chatgpt

Essas referências definem o piso de comparação: não basta responder texto; é preciso mostrar progresso, executar ferramentas, preservar contexto e entregar artefatos.

## Vantagens observáveis neste recorte

- Roteamento determinístico antes do modelo para planilha, imagem, vídeo, áudio, pesquisa, arquivos e memória.
- Widgets explicam intenção, ferramentas, fontes e progresso.
- Respostas locais extremamente rápidas para conhecimento do próprio produto.
- Artefatos locais sem chave, gateway ou serviço pago.
- Cancelamento real do stream.
- Extensão com permissões por site e modo manual.

## Lacunas honestas

- Pesquisa web em tempo real ainda depende de rota externa; o RAG atual usa documentos do projeto.
- Não há projetos multiusuário, compartilhamento e sincronização entre dispositivos como no produto de referência.
- O vídeo browser-only é uma animação Canvas/MediaRecorder, não um modelo generativo de vídeo.
- Ainda não há comparação cega e automatizada contra o ChatGPT nas mesmas tarefas.

## Próximo critério de paridade

1. Pesquisa web com fontes externas citadas e widget de progresso.
2. Projetos locais com arquivos, instruções e memória isolada.
3. Mais ferramentas executáveis dentro do SSE, com schema e confirmação.
4. Benchmark cego em 20 tarefas, medindo acerto, latência, artefatos e custo.
