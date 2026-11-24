# Arquitetura — Myn Recyla/01

## Ideia
Transformar abas de IA gratuitas em rotas reaproveitáveis de agente. Nenhuma chave, nenhum serviço pago, nenhum cookie/senha gravado. Tudo passa pelo gateway mediado.

## Camadas

```
site (HTML/CSS/canvas)  →  site-server (HTTP/SSE/MCP)  →  módulos src/  →  gateway mediado  →  Chromium headless
                                      ↓
                         dados/ (histórico, cache, arquivos, saúde)
```

### `src/`
| Arquivo | Papel |
|---|---|
| `gateway.mjs` | Cliente do gateway. Token relido a cada chamada, renovação no 401, trava de aba compartilhada, OCR com recorte da sidebar. |
| `reparo.mjs` | Reparo determinístico de tool calls escritas como texto. |
| `tools.mjs` | `write_file`, `read_file`, `list_files`, `run_tests` com allowlist e workspace. |
| `agente.mjs` | Agente de uma rota e orquestrador com workers paralelos. |
| `rag.mjs` | Índice TF-IDF local sobre notas, relatórios e brain. |
| `loop.mjs` | Loop planeja → recupera → age → observa → checkpoint, com `AbortSignal`. |
| `auto.mjs` | Myn-01 Auto: escolhe rotas, roda loops e faz fallback. |
| `stream.mjs` | Resposta rápida e streaming SSE via Pollinations, com fallback paralelo entre modelos. |
| `plugins.mjs` | Runner genérico: navegador, API sem chave, gerador local. 62 plugins. |
| `midia.mjs` | PDF (pypdf), OCR (Tesseract), imagem (Pollinations → desenho local), voz (edge-tts), vídeo (ffmpeg). |
| `historico.mjs` | JSONL + cache com TTL. |
| `saude.mjs` | Scoreboard: score 0,45*sucesso + 0,35*velocidade + 0,2*recência; circuit breaker 3-estados. |
| `google.mjs` | Agregador: 13 rotas Google com um login, sem ler cookies. |
| `mcp.mjs` | Servidor MCP JSON-RPC: `tools/list` e `tools/call` com validação, rate limit e confirmação. |

### `scripts/`
- `site-server.mjs` — site, APIs REST, SSE, MCP e agregador Google.
- `smoke.mjs`, `tarefa-longa.mjs`, `orquestrar.mjs` — provas do agente.
- `mapear.mjs` — grava input/output/resposta bruta/print de cada etapa de cada provider.

### `docker/`
- `gateway-headless.mjs` — Chromium headless + CDP local + operações nomeadas + allowlist.
- `entrypoint.sh` — sobe gateway e site dentro do container.

## Endpoints
- `GET /` site · `GET /mapeamento.html` evidências
- `GET /api/chat/stream?message=&pesquisa=1` (SSE)
- `POST /api/chat`, `/api/rag`, `/api/loop`, `/api/auto`
- `GET /api/plugins`, `/api/saude`, `/api/google`, `/api/historico`, `/api/cache`, `/api/arquivos`
- `POST /api/midia`, `/api/documento`, `/api/google/login`, `/api/historico/limpar`
- `POST /mcp` (JSON-RPC MCP)

## Segurança
1. Saída do modelo é **data**, nunca instrução.
2. Ferramentas só com escopo validado e allowlist.
3. Navegação restrita a domínios do allowlist do gateway.
4. Mensageria real só com `confirmar=true`.
5. MCP: `additionalProperties:false`, rate limit, logs sem segredos, `isError` para erros de ferramenta.
6. Sem chave de API, `.env`, token ou senha no repo.

## Estado honesto
- Rotas locais/API (Pollinations, edge-tts, ffmpeg) funcionam.
- Pollinations tem cota comunitária; quando acaba, o desenho local cobre o sujeito do prompt.
- Navegadores com agente pago não são usados; só assistentes free.
- Google exige um login no perfil do gateway; a sessão é persistida no volume.
