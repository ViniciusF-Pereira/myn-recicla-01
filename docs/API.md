# API — Myn Recicla/01

## Chat e dados

- `POST /api/chat`
- `GET /api/chat/stream`
- `POST /api/rag`
- `GET /api/plugins`
- `GET /api/modelos`
- `GET /api/modelos/descobertos`
- `GET /api/saude`
- `GET /api/desempenho`
- `GET /api/arquitetura`

## Mídia e arquivos

- `POST /api/midia` — legado de integração; a interface usa `web/midia/navegador.mjs`.
- `POST /api/documento` — legado de integração; a interface usa pdf.js/Tesseract.js no navegador.
- `GET /api/arquivos`
- `GET /api/arquivos/:nome`
- `GET /api/filmes`
- `GET /api/historico`
- `GET /api/cache`

## Agentes e workers

- `POST /mcp`
- `POST /v1/messages` — compatibilidade Anthropic Messages, streaming, thinking e tool_use.
- `GET /api/token` — token local (loopback).
- `POST /api/token/renovar` — renovação local.
- `GET /api/workers/stream` — SSE combinado.
- `/api/worker-analise/{status,start,stop,stream,eventos}`
- `/api/worker-melhoria/{status,start,stop,stream,eventos}`

## Páginas

- `/`
- `/playground.html`
- `/mapeamento.html`
- `/docs/*`

Google/Gemini não fazem parte da API atual.
