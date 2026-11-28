# Myn Recicla/01 — 1.3.1

## Destaques

- Playground redesenhado: composer limpo, ferramentas avançadas recolhidas e mensagens com mais hierarquia.
- Estúdio de mídia com prompt, estilo, formato, duração, preview, download e histórico.
- Imagem com estilos editoriais e fallback Canvas; vídeo com temas, movimento e barra de progresso.
- Extensão redesenhada com logo real, abas Rotas/Chats/Lojas, diagnósticos recolhidos e botões maiores.
- SSE com eventos semânticos `response.created`, `tool.start`, `tool.end`, `response.in_progress`, `response.output_text.delta` e `response.completed`.
- Widgets de orientação de intenção, progresso de ferramentas e fontes locais.
- Cancelamento e reconexão de stream no Playground, sem repetir rotas explícitas.
- Roteador determinístico para planilha, imagem, vídeo, áudio, pesquisa, arquivos e memória.
- RAG local aquecido no startup e respostas locais rápidas para conhecimento do produto.
- Roteamento de pesquisa corrigido para verbos como “pesquise” e fontes preservadas nas respostas diretas do RAG.
- Benchmark executável em `scripts/benchmark-agente.mjs` e documento `docs/BENCHMARK_AGENTE.md`.

## Evidência

- `node --test`: **89/89**.
- Extensão isolada: **25/25**.
- Python offline: **24/24**.
- Playground desktop/mobile: sem overflow; estúdio, preview e download validados.
- SSE/widgets/cancelamento: validados no navegador.
- Benchmark: orientação **6/6**; três rodadas por caso, todas aprovadas; mediana do primeiro token **21 ms** para identidade local e **13 ms** para pesquisa local nesta máquina.

## Limites

- Pesquisa web em tempo real ainda depende de rota externa.
- Vídeo browser-only é animação Canvas/MediaRecorder.
- Não houve comparação direta paga com o ChatGPT; o benchmark é baseline verificável do Myn.
- O preview do vídeo promocional continua aguardando aprovação para render.
