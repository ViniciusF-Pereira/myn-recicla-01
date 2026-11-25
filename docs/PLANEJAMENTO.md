# Planejamento — Myn Recicla como agente open-source web-only

**Diretriz do dono (24/11/2026):** o produto usa **somente rotas FREE de navegador online + WebGPU**. Nada de execução local em PC físico: sem `ffmpeg`, `PIL`, `Tesseract`, binários, CDP na máquina do usuário ou automação de desktop. O computador do usuário roda **apenas o navegador**. Gateway/CDP, se existir, vive em **container hospedado**, nunca no PC.

## Consultas feitas antes de planejar
1. **Agente de arquitetura** — parecer recebido e incorporado abaixo.
2. **O próprio produto**: `POST /api/plan` com o objetivo → voltou `deterministico` (a API de linguagem falhou), 4 passos. `POST /api/orquestrar` com `rapido:true` → vencedor **`image-local`**, com `pollinations-image-api` e `voice-local` também no topo. **Isso é a prova do problema**: no modo rápido o Myn ainda prefere rotas locais, o que viola a diretriz. A arquitetura precisa inverter isso.
3. **Navegador atual**: `navigator.gpu === true` e `isSecureContext === true` — WebGPU está disponível no cliente, então o plano é executável.
4. **Eu**: priorizei confiabilidade e eliminação das rotas locais antes de qualquer feature nova.

## Diagnóstico

O Myn hoje tem o que poucos projetos free têm: 167 plugins, 13 rotas Google, streaming SSE, scoreboard com circuit breaker, RAG, MCP goal autônomo, WEBdocker e documentação com prova. Mas ainda é **um servidor local com um site na frente**. Para virar “um OpenCode que roda no navegador” é preciso mudar o centro de gravidade: o agente passa a viver no browser do usuário, com compute WebGPU e ferramentas online.

O incidente da consulta ao produto mostra a dívida: quando a API rápida falha, `escolherPara(..., rapido=true)` cai para `config/modelos.json` e escolhe `image-local`. Isso tem que virar: **falha de API → outra API online → resposta determinística honesta**, nunca binário local.

## Arquitetura alvo (browser-first)

Entrypoints: `site/index.html`, `site/playground.html` e `site/app.mjs` (SPA com `/plan`, `/goal`, `/loop`, `/id`). Nenhum `node:*` no bundle.

| Camada | Módulos | Papel |
|---|---|---|
| Orquestrador | `web/core/orquestrador.mjs`, `planejador.mjs`, `agendador.mjs` | contrato `{acao,alvo,entrada,criterio}`; `/plan → /loop → /goal`; timers no browser + checkpoint em IndexedDB |
| Adapters de rota | `web/adapters/roteador.mjs`, `browser-route.mjs`, `api-free.mjs`, `google.mjs` | leem `config/modelos.json` e `plugins.json`; chamam gateway **hospedado** ou APIs anônimas; SSE portado para `fetch` |
| Tools com escopo | `web/tools/registro.mjs`, `executor.mjs` | virtual FS, Blob/download, clipboard, File System Access com escolha explícita; **sem `run_tests`/`execFile`** |
| Reparo/validação | `web/tools/reparo.mjs` | porta pura de `src/reparo.mjs` (TOOL/JSON balanceado) |
| WebGPU | `web/inferencia/embeddings-gpu.mjs`, `llm-gpu.mjs`, `postproc.mjs` | embeddings, inferência leve, pós-processamento |
| RAG | `web/rag/store.mjs`, `buscar.mjs` | índice vetorial em IndexedDB; TF-IDF/regex como fallback |
| Verificação | `web/verificacao/criterios.mjs`, `saude.mjs` | score `0,45·sucesso + 0,35·velocidade + 0,2·recência`, circuito 3-estados; checa `criterio` de cada passo |
| Persistência | `web/persistencia/local.mjs`, `sync.mjs` | IndexedDB para histórico/cache/vetores/goals; sync opcional com `/api/*` hospedado |
| Serviços na nuvem | `services/gateway/`, `services/relay/`, `services/mcp.mjs` | Chromium/CDP e allowlist no container; relay quebra CORS; MCP expõe 11 ferramentas na URL pública |

### WebGPU: onde ele entra
- `embeddings-gpu.mjs`: Transformers.js + ONNX Runtime Web com WebGPU (all-MiniLM-L6-v2 quantizado) para RAG vetorial.
- `llm-gpu.mjs`: modelo pequeno (1–3B) **apenas** para classificar tarefa, reparar tool-call e compactar contexto. Não substitui o modelo grande das rotas free.
- Cascata: **WebGPU → WASM → TF-IDF/regex**. Badge visível mostra qual capacidade está ativa.
- Saída de modelo continua **dado, nunca instrução**.

### Substituição das capacidades hoje locais
| Hoje (local) | Substituto web-only | Limite honesto |
|---|---|---|
| PIL (`midia.mjs`) | Pollinations image / Nano Banana via gateway; fallback canvas/SVG generativo no cliente | cota comunitária; fallback abstrato |
| edge-tts | `speechSynthesis` pt-BR + rota TTS online free | voz varia; sem garantia offline |
| ffmpeg | `MediaRecorder` + canvas/WebGPU animado → `.webm` | sem MP4 garantido; clipes curtos |
| Tesseract/OCR | upload para Gemini Lens/visão via gateway; Shape Detection API onde existir | depende de login Google |
| `write_file`/`run_tests` | virtual FS + download/File System Access | nada executa no PC; permissão explícita |

## Roadmap em fases

**Fase 0 — Fundação web (primeira, obrigatória)**
1. Cortar Node do browser: aceite = app abre sem `node:*` e sem `localhost:5188`; console limpo.
2. Portar reparo + tools virtuais: aceite = tool-call inválido recusado com `fora_do_escopo`; nada escrito fora do virtual FS.
3. Inverter `rapido`: aceite = `/api/orquestrar?rapido=true` **nunca** devolve `*-local`; se todas as APIs online falharem, devolve resposta determinística com `via: determinístico`.

**Fase 1 — Orquestração confiável**
4. Scoreboard no cliente: aceite = `window.myn.saude()` mostra score/circuito; 3 falhas abrem o circuito.
5. Adaptadores + orquestrador: aceite = `window.myn.orquestrar({tarefa,max:2,rapido:true})` devolve vencedor e todas as respostas.
6. Gateway/relay hospedado: aceite = SSE com primeiro token; nenhum arquivo de token no PC do usuário.

**Fase 2 — RAG e WebGPU**
7. RAG vetorial: aceite = `window.myn.rag(...)` retorna fontes com score; desligando WebGPU, TF-IDF responde.
8. Inferência leve: aceite = classificação e reparo válidos com WebGPU ligado e desligado.

**Fase 3 — Agente de código**
9. Planejador determinístico-first: aceite = `/api/plan` devolve ≤6 passos com `via`; funciona sem rede.
10. Tool-use dentro do streaming: eventos `TOOL/RESULTADO/TOKEN/DONE` intercalados, com escopo validado.
11. Goal no browser: aceite = criar/listar/cancelar goal preserva checkpoint no IndexedDB.
12. Verificação por critério: aceite = cada passo marca `criterio` com evidência; falha não some.

**Fase 4 — Mídia e OCR online**
13. Imagem/vídeo/voz sem binário: aceite = imagem data-URL, voz falada, vídeo `.webm` baixado; `ffmpeg`/PIL ausentes do bundle.
14. OCR online: aceite = upload → texto; sem rota, aviso honesto sem quebrar o fluxo.

**Fase 5 — Open-source e distribuição**
15. MCP hospedado com stdio: aceite = `POST /mcp` na URL pública lista 11 tools; cliente externo conecta sem localhost.
16. CI com bateria: `node:test` + providers mockados no GitHub Actions; toda mudança prova as rotas.
17. README com prints, license, CONTRIBUTING e limites claros.

## Riscos e degradação
- **Cota/recusa**: circuit breaker abre, cai para API online seguinte e depois para resposta determinística; nunca inventar fonte. Erro de política vira `isError`, não crash.
- **Login Google**: rotas `login:true` pedem “conectar”; o resto segue anônimo. Nunca coletar cookie/senha no browser do usuário.
- **CORS/anti-bot**: relay hospedado com allowlist; se falhar → API-free → determinístico. Nunca automatizar desktop.
- **WebGPU ausente**: WASM/TF-IDF; lazy-load e teto de cache IndexedDB.
- **Gateway é SPOF**: token curto, renovação no 401, trava por aba no container; indisponível ⇒ app segue com WebGPU + rotas online diretas.

## O que NÃO fazer
- Não portar as 167 plugins cegamente — começar pelas que são API online.
- Não transformar isso em IDE nem reintroduzir CDP/ffmpeg no host.
- Não usar serviço pago ou chave de API.
- Não trocar o scoreboard por ML antes de ter falha reproduzível.
- Não confiar em saída de modelo como comando sem validação de escopo.

## Como provar que funciona
`node scripts/avaliar.mjs` (bateria atual, 15/15) +, na Fase 0, um teste de aceite web-only que falhe se qualquer módulo `*-local` aparecer no modo rápido. `docs/AVALIACAO.md` e `docs/prints/` ficam como evidência pública.
