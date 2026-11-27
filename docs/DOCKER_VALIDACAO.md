# Validação Docker — Myn Recicla/01

Data: 25/11/2026.

Imagem construída: `myn-recicla-01:dev` (`node:22-bookworm-slim`).

## Build

`docker build -t myn-recicla-01:dev .` concluído com sucesso.

## Testes executados no container

- `GET /` → 200, `content-encoding: gzip`.
- `GET /web/core/orquestrador.mjs` → 200, JavaScript (camada web incluída).
- `GET /api/plugins` → 200, 154 plugins, nenhum Google/Gemini.
- `GET /api/google` → 410 `google_removido`.
- `GET /api/arquitetura` → 57 módulos, 78 dependências, 0 ciclos/violações/imports quebrados.
- Worker de análise: `start` → 1 ciclo → `finalizado`.
- Git local: branch `master`, commit `base do container`.
- `node --test` dentro do container → 46/46 testes passando.
- Processo executado como usuário `myn` (UID 10001), não root.
- Healthcheck respondeu `200` em `/api/saude`.
- Assets do WORK e painel atual presentes: `site/assistente.mjs`, `site/dados-atuais.mjs` e `docs/RELATORIO_UNICO.html`.
- Token local no container: sem `Authorization` → 401; com token válido → 200.
- `.dockerignore` reduziu o contexto de dezenas de MB para cerca de 1,3 MB, excluindo `dados/`, logs e outputs.
- Imagem browser-only: sem Python, PIL, ffmpeg, edge-tts ou Tesseract; mídia acontece no navegador.

## Infra

- Token renovado automaticamente com `TTL=10000`: hash do arquivo mudou após 7 segundos.
- Persistência: arquivo gravado em `/data` continuou presente após `docker restart` com volume nomeado.
- Porta de teste: `5189:5188` para não conflitar com o servidor local da porta 5188.

## Limite

O gateway headless foi iniciado, mas nenhuma rota externa de navegador foi acionada neste teste; a validação cobriu HTTP local, workers, Git, token e volume.
