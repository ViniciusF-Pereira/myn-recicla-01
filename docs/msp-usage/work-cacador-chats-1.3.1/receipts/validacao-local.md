# Recibo sanitizado — WORK caçador de chats 1.3.1

Data: 2026-11-28 (UTC).

## Escopo

- Projeto: `myn-Recicla-01`.
- Tarefa: redesign do Playground/extensão, Estúdio de Mídia, SSE semântico, tools/widgets, cancelamento, reconexão e benchmark.
- Chamadas MSP: nenhuma. Houve implementação local e revisão por subagente.
- Segredos, tokens, cookies e conteúdo de conversas: não incluídos.

## Comandos e resultados

- `node --test`: 89 testes, 89 aprovados, 0 falhas.
- `node scripts/testar-extensao.mjs`: Edge 158.0.4370.45, extensão 1.3.1, 25/25 aceites.
- `python -m unittest discover -s tests -p "test_varredura_web.py" -v`: 24/24.
- `npm run benchmark`: orientação 6/6; 6/6 verificações SSE; mediana do primeiro token 21 ms (identidade) e 13 ms (pesquisa), nesta máquina.
- Playground desktop 1440×1000 e mobile 390×844: overflow=false.
- Estúdio: preview local, download liberado e histórico validados.
- SSE/widgets: fontes, ferramentas e texto recebidos.
- Cancelamento: mensagem de cancelamento e botões restaurados.
- Reconexão: rota automática com 2 tentativas e resposta na segunda; rota explícita com 1 tentativa, sem repetição.
- Home: 190 plugins, sticky header, sem imagens quebradas ou falhas de rede.
- QA de navegador: `qa-home.mjs`, `qa-playground-studio.mjs`, `qa-sse-widgets.mjs`, `qa-sse-reconnect.mjs` e `qa-planilha.mjs`.
- Os `net::ERR_FAILED` do estúdio e da reconexão são abortos provocados pelo próprio QA para testar fallback e repetição.

## Artefatos

- ZIP: `site/extensao/myn-recicla-extensao.zip` (16 arquivos, conteúdo idêntico às fontes)
- SHA256: `5DFBE6F1968B2D6315463C40A1ECC1B8706D76C679F4538635A398230FED41CE`
- Relatório de aceite: `outputs/extensao-teste.json`
- SHA256: `5F3D89FEC4B6B31D2A0E58431CF253AF5060D98A562C486EAC23C4834EA6F311`
- Benchmark: `outputs/benchmark-agente.json`
- SHA256: `1BFB0F90D6C600D76AC72A56558B5F7EA62DCB3AAFD5153DCF28DE4ECCD04CF8`
- Guia: `docs/PLAYGROUND.md`
- Benchmark documentado: `docs/BENCHMARK_AGENTE.md`

## Limites

- Sem comparação direta paga com o ChatGPT.
- Pesquisa web externa depende de rota.
- Vídeo é Canvas/MediaRecorder WebM.
- Render do vídeo promocional aguarda aprovação.
