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
- `node --test` dentro do container → 21/21 testes passando.
- Processo executado como usuário `myn` (UID 10001), não root.
- Healthcheck respondeu `200` em `/api/saude`.

## Infra

- Token renovado automaticamente com `TTL=10000`: hash do arquivo mudou após 7 segundos.
- Persistência: arquivo gravado em `/data` continuou presente após `docker restart` com volume nomeado.
- Porta de teste: `5189:5188` para não conflitar com o servidor local da porta 5188.

## Limite

O gateway headless foi iniciado, mas nenhuma rota externa de navegador foi acionada neste teste; a validação cobriu HTTP local, workers, Git, token e volume.
