# Agentes e modelos dentro de cada rota

Descobrir **qual modelo e agente** existe atrás de cada rota é o que permite orquestrar e paralelizar. Sem isso, o Auto distribui tarefas no escuro.

## Mapa (fonte: docs oficiais, nov/2026)

| Rota | Modelo interno | Agente / ferramentas | Melhor uso |
|---|---|---|---|
| `brave-leo` | GPT-6 Luna (default), Qwen 3.6 35B, GLM 4.7 Flash, Nemotron 3 30B, Claude Haiku 4.5 | Brave AI Gateway, sem conta, sem log | chat, resumo, abas, PDF |
| `zai` | GLM-5.3-Flash (320B/18B ativos, 1M ctx, multimodal) · GLM-5.4 no Coding Plan | tool calling, visual coding, BUA/CUA | código, agente longo, documento, visão |
| `gemini` | Gemini 3.6 Flash (free) | Deep Research, Create images | pesquisa, upload, imagem |
| `nano-banana` | Nano Banana / 2.1 | geração e edição de imagem | imagem |
| `openrouter` | 600+ modelos; `:free` | router free | multi-modelo, código |
| `chatgpt` | GPT-5.x web | voz, busca, ferramentas | chat, voz |
| `claude` | Claude Sonnet/Opus 5.5 | artifacts, ferramentas | código, documento, longo |
| `hugging` | comunitário (Qwen/Llama/Mistral) | community tools | multi-modelo |
| `kimi` | Kimi K2.5 / K3 | busca, imagem, Responses API | longo, pesquisa, código |
| `mistral` | Mistral Large 4 · GLM 5.3 Flash | web search, PDF, image gen | documento |
| `perplexity` | Sonar / Sonar Pro | citações | pesquisa com fontes |
| `copilot` | GPT-5.x Microsoft | busca, imagem, voz | pesquisa, imagem |
| `grok` | Grok 4.7 | X/web, voz | tempo real |
| `lmarena` | 40+ modelos | comparação cega | benchmark |
| `pollinations-text-api` | rotativo (gpt-oss-20b observado) | API anônima | rápido, API |
| `pollinations-image-api` | flux/turbo | API de imagem | imagem via API |
| `image-local` | PIL determinístico | sem rede | imagem offline |
| `voice-local` | edge-tts (pt-BR-FranciscaNeural) | sem rede | voz offline |
| `video-local` | ffmpeg Ken Burns | sem rede | vídeo offline |
| `google-veo` | Veo 3.1 / Sora 2 / Kling | labs.google | vídeo online free |
| `notebooklm` | Gemini com fontes | citações, podcast | pesquisa com fontes |
| `google-chat` / `google-messages` | — | MCP / SMS-RCS | mensageria (confirmar) |

## Como isso alimenta o orquestrador

`config/modelos.json` é a versão legível por máquina: cada rota tem `modelo`, `agente`, `capacidades`, `contexto`, `limite` e `fonte`.

`src/orquestrar-modelos.mjs`:
1. `classificarTarefa(texto)` extrai capacidades do pedido (`codigo`, `pesquisa`, `imagem`, `video`, `voz`, `documento`, `raciocinio`, `longo`, `visao`, `rapido`).
2. `escolherPara()` filtra rotas por capacidade e ordena pelo **scoreboard** (`src/saude.mjs`): 0,45*sucesso + 0,35*velocidade + 0,2*recência, com circuit breaker 3-estados.
3. `orquestrar()` dispara até N rotas com `Promise.all`, registra saúde de cada uma e escolhe a melhor resposta por nota (penaliza recusa/erro, premia conteúdo).

Endpoint: `POST /api/orquestrar` com `{ "tarefa": "...", "max": 3 }`.

## Regras para paralelismo
- Rotas de mensageria nunca entram no paralelo (`confirmacao:true`).
- Circuitos abertos são skipados; half-open recebe uma sonda.
- Erro de conteúdo/política não derruba a rota — o gerador local cobre.
- O vencedor é marcado, mas **todas as respostas** voltam no JSON para auditoria.
