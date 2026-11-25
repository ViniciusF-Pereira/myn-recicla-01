# Aceite web-only — Fase 0/1

Executado no navegador (`http://127.0.0.1:5188/playground.html`), sem Node no cliente e sem binário local.

| Verificação | Resultado |
|---|---|
| `window.myn` carregado como módulo ES | ✅ `myn: object`, `document.documentElement.dataset.myn = pronto` |
| WebGPU | ✅ `navigator.gpu = true`, contexto seguro, `modo: webgpu` |
| Tools virtuais | ✅ `escrever('teste-web.txt','ola myn')` → nome; `ler` → conteúdo. IndexedDB, nada no disco |
| Reparo de tool-call | ✅ `TOOL write_file path=nota content=teste` → `{tool:'write_file',args:{...}}` |
| RAG no cliente | ✅ `/api/plugins` semeado; `rag('gemini')` → fontes “Catálogo de plugins”, “Saúde das rotas” |
| Orquestrador web | ✅ `window.myn.orquestrar({tarefa,max:2,rapido:true})` → rotas `pollinations-image-api, pollinations-text-api`, **local: false**, 10,5 s |
| LLM WebGPU | ✅ `window.myn.llm.disponivel() === true`; modelo `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` carregado sob demanda |
| Recusa de rota | ✅ não desvia mais para imagem; cai para WebGPU ou mensagem honesta com troca de rota |
| Botões mídia/plugins | ✅ imagem, áudio, vídeo geram artifact; painel de plugins lista 62 |
| Servidor `/web/*` | ✅ módulos ES com MIME `text/javascript` |
| Playground | ✅ em página própria, chat funcional, botão da home abre nova aba |

## Correções feitas nesta rodada
- `app.mjs` não carregava: `/web/*` estava fora da raiz servida e `.mjs` caía em `application/octet-stream`. Rotas estáticas e MIME adicionados.
- Cache do navegador manteve o MIME antigo: script passou a `app.mjs?v=2`.
- `rapido` escolhia `*-local`: invertido para somente `acao:'api'`; fallback determinístico quando as APIs falham.

## Limite honesto
O módulo de embeddings (`web/inferencia/embeddings-gpu.mjs`) detecta WebGPU e tenta carregar Transformers.js sob demanda; se o CDN falhar, o RAG segue em TF-IDF. Nenhum modelo local é baixado sem necessidade.
