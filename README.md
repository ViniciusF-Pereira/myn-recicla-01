# Myn-Portable

Versão mínima e portátil do Myn: **somente rotas Browser**. Sem chaves de API, sem Codex, sem provedores pagos.

## O que tem

- `src/gateway.mjs` — cliente do gateway mediado (token curto, operações nomeadas, trava para aba compartilhada).
- `src/reparo.mjs` — reparo determinístico de tool calls escritas como texto + extração de resposta.
- `src/tools.mjs` — `write_file`, `read_file`, `list_files`, `run_tests`, sempre dentro do workspace e com allowlist.
- `src/agente.mjs` — agente de uma rota e orquestrador com workers em paralelo.
- `src/rag.mjs` — índice TF-IDF local sobre notas/relatórios/docs, com citação de fonte.
- `src/loop.mjs` — agente em loop: planeja → recupera (RAG) → age → observa → checkpoint.
- `src/auto.mjs` — **Myn-01 Auto · Free**: escolhe rotas do mapa, roda loops e faz fallback sozinho.
- `src/stream.mjs` — resposta rápida e **streaming SSE** via Pollinations (sem chave), com fallback paralelo entre modelos.
- `src/plugins.mjs` — runner genérico de plugins: navegador, API sem chave e geradores locais.
- `src/midia.mjs` — documentos (PDF pypdf, imagem OCR), imagem (Pollinations), voz (edge-tts), vídeo (ffmpeg).
- `src/historico.mjs` — histórico JSONL + cache com TTL de toda entrada/saída do Playground.
- `scripts/site-server.mjs` — site + APIs `/api/chat`, `/api/rag`, `/api/loop`, `/api/auto`, `/api/historico`, `/api/cache`.
- `scripts/mapear.mjs` — mapeia cada provider e grava **toda etapa** (input, output, resposta bruta, prints).
- `config/rotas.json` — rotas Browser (Z.ai, HuggingChat, OpenRouter, ChatGPT, Claude, Brave Leo).
- `config/providers.json` — metadados de 14 providers (ferramentas, idioma, limites, modo de envio).
- `site/index.html` — site Myn Recyla/01 com Playground (5 telas).
- `site/mapeamento.html` — página de evidências com input/output de cada etapa do mapeamento.
- `Dockerfile`, `docker-compose.yml`, `docker/` — VM com Chromium **headless**, nada abre no PC.
- `docs/RELATORIO_UNICO.html` — relatório consolidado de toda a pesquisa e validação.

## Pré-condição

O gateway precisa estar rodando na máquina com o **Brave** logado (rota `brave://leo-ai`):

```powershell
cd "D:\0 - Projetos\Myncellium"
$env:MYNCELLIUM_GATEWAY_REAL_CHROME='1'
$env:MYNCELLIUM_GATEWAY_CHROME='C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe'
$env:MYNCELLIUM_GATEWAY_PROFILE='D:\0 - Projetos\Myncellium\.state\brave-agente-myn'
$env:MYNCELLIUM_GATEWAY_DEBUG_PORT='9333'
$env:MYNCELLIUM_VM_GATEWAY_PORT='36877'
$env:MYNCELLIUM_VM_GATEWAY_TOKEN_FILE='C:\Users\Vini\AppData\Local\Temp\opencode\gateway-brave-token.txt'
node scripts/gateway-vm.mjs
```

O token expira em 30 min; reinicie o gateway quando `capability expirada` aparecer.

## Uso

```powershell
cd "D:\0 - Projetos\Myn-Portable"
node scripts/site-server.mjs        # site em http://127.0.0.1:5188
node scripts/smoke.mjs
node scripts/tarefa-longa.mjs
node scripts/orquestrar.mjs
node scripts/mapear.mjs             # mapeia os 14 providers (grava evidências)
node scripts/mapear.mjs zai grok    # ou só alguns
```

### Playground (no site)

A tela inicial fica limpa; o Playground abre pelo botão **▶ ABRIR PLAYGROUND /01**. São 5 modos na lateral:

- **⚡ Myn-01 Auto · Free** — você dá o objetivo; o Auto recupera contexto com RAG, pega as rotas `utilizavel` do mapa, roda o agente e faz fallback. Tentativa, passos e vencedora aparecem na trilha.
- **Chat -01** — conversa direta com a rota escolhida.
- **Agente loop** — RAG + ferramentas com escopo + checkpoint.
- **RAG** — busca nos docs com citação de arquivo.
- **Histórico / cache** — tudo que passou pelo Playground, com `IN`, `OUT`, tempo e flag `CACHE`.

APIs: `GET /api/chat/stream?message=&pesquisa=1` (**SSE, token a token**), `POST /api/chat`, `/api/rag`, `/api/loop`, `/api/auto`, `GET /api/plugins` (55 plugins), `POST /api/documento`, `POST /api/midia`, `GET /api/arquivos`, `GET /api/historico`, `GET /api/cache`, `POST /api/historico/limpar`.

**Streaming e pesquisa**: o chat usa SSE e mostra os tokens chegando (primeiro token em ~0,6–2,4 s). O botão **pesquisar** (ou `/pesquisa ...`) cruza RAG local + catálogo de plugins antes de responder; se as APIs falharem, devolve o mapa local em vez de travar.

**Plugins no chat**: `/plugin mensagem` roda qualquer plugin de `config/plugins.json`. Exemplos: `/pollinations-text-api oi`, `/gemini explique X`, `/image-local um gato reciclado`. Mensageria (Google Chat, Messages, Telegram, WhatsApp, Discord) exige `/id confirmar: mensagem` — nada é enviado sem confirmação.

**Mídia no chat**: botões de imagem, áudio e vídeo usam Pollinations (free, sem chave), edge-tts (pt-BR, ~1500 caracteres) e ffmpeg local (clipe Ken Burns). Anexos até 12 MB: PDF via pypdf, imagem via OCR; CSV/MD/JSON/TXT direto. Tabelas markdown viram `<table>` na resposta.

**Visual**: colagem surreal (céu gerado por Pollinations), rasgo de papel com olho do Myn, hachura e mostarda, canvas com "Mini Myns" (olhinhos alados com halo), favicon SVG com asas, e cores azul/coral/teal/lilás/limão.

### Mapeamento como prova

`node scripts/mapear.mjs` grava em `outputs-evidencia-mapeamento.json` e `site/mapeamento.json`: URL navegada, texto lido, detecção de login, foco no composer, cada tecla/clique, a resposta OCR bruta de até 10 tentativas e o caminho do print. Abra `http://127.0.0.1:5188/mapeamento.html` para ver evento a evento.

### VM (sem abrir navegador no PC)

```powershell
cd "D:\0 - Projetos\Myn-Portable"
docker build -t myn-recyla-01 .
docker run -d --name myn-recyla-01 -p 5188:5188 -v recyla-dados:/data myn-recyla-01
```

(Se o plugin `docker compose` estiver instalado, `docker compose up --build -d` faz o mesmo.)

O Chromium roda **headless dentro do container**; o gateway headless expõe as mesmas operações nomeadas com allowlist de domínio e token de 30 min. O site sobe em `http://127.0.0.1:5188`. Histórico e cache ficam no volume `recyla-dados` (`/data`), então sobrevivem a `docker compose down`. Para rodar o mapeamento dentro da VM:

```powershell
docker exec myn-recyla-01 node /app/scripts/mapear.mjs
```

## Regras de segurança

1. Nada do modelo é executado como instrução — só parseado e validado.
2. Ferramentas só aceitam arquivos da allowlist e dentro do workspace temporário.
3. Orquestrador usa `Promise.all` para paralelismo, mas serializa operações do navegador com uma trava (uma aba compartilhada).
4. Nenhuma chave, `.env`, rota sensível ou código do projeto é enviado ao modelo.

## Estado das provas

- `node scripts/smoke.mjs` — **ok** (1/1, rota `brave-leo`, arquivo `smoke.txt` criado).
- `node scripts/orquestrar.mjs` — orquestrador + workers com `Promise.all` e trava de aba: **1/3** na última execução; as outras duas falharam por limite de taxa/OCR do Leo, não pelo harness.
- `node scripts/tarefa-longa.mjs` — tarefa de 6 arquivos: **2/6** na última execução com rotas web externas; instável conforme login/limite de cada site.

Origem: `D:\0 - Projetos\Myncellium`, commits `1c5ffc2b` … `4c1c90cc`.
