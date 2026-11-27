# Myn — Recicla/01

**De aba descartada a rota reaproveitada.** Agente portátil que transforma chats e serviços gratuitos da web em rotas utilizáveis — sem chave de API, sem assinatura, sem Codex, sem abrir navegador no PC.

Repo: **https://github.com/ViniciusF-Pereira/myn-Recicla-01**

## Prints

| Tela | Print |
|---|---|
| Início (catalog, plugins, ciclo, sobre) | ![Início](docs/prints/01-home.jpg) |
| Playground (chat, streaming, mídia) | ![Playground](docs/prints/02-playground.png) |
| Mapa de provedores com input/output | ![Mapeamento](docs/prints/03-mapeamento.png) |

> O Playground **não fica na tela inicial**. O botão **ABRIR PLAYGROUND /01** abre `playground.html` em uma nova aba.

## O que é

- **154 plugins** em 9 categorias: chat, imagem, vídeo, voz, agentes, mensageria, APIs, pesquisa e utilidade. Google/Gemini foram removidos do catálogo público.
- **Descoberta de modelos livres** via Pollinations, OpenRouter e HuggingFace (endpoints públicos, sem chave), com filtro de preço e modalidade.
- **Chat com streaming SSE** (primeiro token em ~15 ms), pesquisa com RAG + catálogo, anexos, tabelas markdown e arquivos.
- **Mídia browser-only**: imagem (Pollinations/Canvas), voz (SpeechSynthesis), vídeo/animação (Canvas + MediaRecorder), OCR (Tesseract.js) e PDF (pdf.js).
- **Myn-01 Auto**: escolhe rotas por capacidade e saúde, roda em paralelo e escolhe a melhor resposta.
- **Scoreboard**: score = 0,45·sucesso + 0,35·velocidade + 0,2·recência, com circuit breaker de 3 estados.
- **MCP** JSON-RPC com 11 ferramentas para agentes externos.
- **Goal autônomo**: `/plan` → `/loop` → `/goal` com agendador usando a própria API.
- **WEBdocker.NODEJS**: container com Chromium headless — as rotas rodam no aparelho de quem executa.

## Começar

```powershell
cd "D:\0 - Projetos\Myn-Portable"
node scripts/site-server.mjs        # http://127.0.0.1:5188
```

Gateway Brave (se quiser as rotas de navegador no host):
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

## Uso no chat

- Escreva e aperte **Enter** → streaming token a token.
- **🔎 pesquisar** ou `/pesquisa pergunta` → cruza RAG + plugins antes de responder.
- **🖼 imagem / 🔊 áudio / 🎬 vídeo** → clique com texto no campo gera na hora; com campo vazio fica “armado” para o próximo Enter.
- **🔌 plugins** → painel com os 154 plugins; clique insere `/id ` no campo.
- **🧠 modelos** → catálogo descoberto por fontes públicas, sem Google/Gemini.
- **📜** → gaveta com histórico, cache e tempos.
- Comandos: `/plan objetivo`, `/loop objetivo`, `/goal objetivo`, `/id mensagem`. Mensageria exige `/id confirmar: texto`.

## APIs

| Método | Rota | Uso |
|---|---|---|
| GET | `/` · `/playground.html` · `/mapeamento.html` | site, playground, evidências |
| GET | `/api/chat/stream?message=&pesquisa=1` | SSE token a token |
| POST | `/api/chat` | chat, comandos e plugins |
| POST | `/api/rag` · `/api/loop` · `/api/auto` | RAG, loop, auto |
| POST | `/api/plan` · `/api/goal` · `/api/goal/rodar` | planejamento e goal autônomo |
| GET/DELETE | `/api/goal` | listar/remover goals |
| POST | `/api/orquestrar` | paralelismo por capacidade (`rapido:true`) |
| GET | `/api/plugins` · `/api/saude` · `/api/desempenho` · `/api/arquitetura` · `/api/modelos/descobertos` | catálogo, saúde, métricas e modelos |
| POST | `/api/midia` · `/api/documento` | imagem/voz/vídeo, anexos |
| GET | `/api/arquivos` · `/api/historico` · `/api/cache` | arquivos, caderno, cache |
| POST | `/mcp` | MCP JSON-RPC (`initialize`, `tools/list`, `tools/call`) |

## WEBdocker.NODEJS

```powershell
cd "D:\0 - Projetos\Myn-Portable"
docker build -t myn-recicla-01:dev .
docker run -d --name myn-recicla-01 -p 5188:5188 -v myn-recicla-dados:/data myn-recicla-01:dev
```
Sobem: site (5188), gateway headless (36877 interno) e Chromium sem janela. Para distribuir:
```powershell
docker save myn-recicla-01:dev -o myn-recicla-01.tar
# na outra máquina: docker load -i myn-recicla-01.tar; docker run -d -p 5188:5188 -v myn-recicla-dados:/data myn-recicla-01:dev
```
Validação executada em [`docs/DOCKER_VALIDACAO.md`](docs/DOCKER_VALIDACAO.md): build, web, APIs, worker, Git, renovação de token, volume e 11 testes.

## Verificação (prova)

```powershell
node scripts/avaliar.mjs     # 15 baterias → docs/AVALIACAO.md
node scripts/mapear.mjs      # grava input/output/print de cada provider
```
Última bateria: **15/15 OK**. Detalhes em [`docs/AVALIACAO.md`](docs/AVALIACAO.md), evolução em [`docs/EVOLUCAO.md`](docs/EVOLUCAO.md), modelos por rota em [`docs/AGENTES_E_MODELOS.md`](docs/AGENTES_E_MODELOS.md) e arquitetura em [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md).

**Direção web-only:** [`docs/PLANEJAMENTO.md`](docs/PLANEJAMENTO.md) — evoluir o Myn para agente open-source tipo OpenCode/Claude Code/Codex usando **somente rotas free de navegador + WebGPU**, sem binário/local PC. Fase 0 item 3 já entregue: `/api/orquestrar?rapido=true` nunca escolhe rotas `*-local`.

**Workers separados:** `docs/WORKER_INFINITO.md`. Análise (`/api/worker-analise/*`) mede código, desempenho, modelos e arquitetura. Melhoria (`/api/worker-melhoria/*`) aplica achados reproduzíveis, roda `node --test`, usa lock de processo, smoke pós-merge e rollback. Merge automático por allowlist, sem revisão humana; desligue com `MYN_AUTO_MERGE_CODIGO=0`. O fluxo padrão não envia código para LLM. Sem Gemini/Google.

**Ponte Telegram:** `docs/PONTE_TELEGRAM.md`. O bot local injeta mensagens em uma sessão real do OpenCode e devolve a resposta ao Telegram; `/myn` usa o Myn, `/status` e `/worker` mostram os workers. Token, ID e sessão ficam em `dados/`, fora do Git.

**Núcleo do agente:** `/api/agente` centraliza memória, classificação, RAG, planejamento e resposta. A memória persistente fica em `dados/memoria.jsonl`. Veja `docs/NUCLEO_AGENTE.md`.

**Rota local de agente:** `npm run token` ou o botão **agente local** no Playground emite/copia/renova o token para usar o Myn por MCP ou por uma rota estilo Anthropic Messages (`/v1/messages`), com streaming, tools e resumo de raciocínio. Veja `docs/ROTA_AGENTE_LOCAL.md`.

**WORK — assistente virtual:** presente em todas as telas, com mascote animado, apresentação narrada, som, mini-chat, voz, microfone, anexos, players de áudio/vídeo, ações rápidas, histórico persistente, cancelamento e ferramentas MCP visíveis em uso. Veja `docs/ASSISTENTE_WORK.md`.

**Created By (seção 06 da home):** `node scripts/atualizar-perfil.mjs` busica dados públicos do GitHub via `gh api` e grava `site/perfil.json` — foto, bio, números, repos e LinkedIn (achado no campo `blog` do GitHub). Sem segredos.

Goal mestre para dirigir a entrega completa:
```powershell
node scripts/criar-goal-tudo.mjs
```
Ele cria o goal com as 6 fases do planejamento e roda um ciclo imediato. Acompanhe com `GET /api/goal`; cancele com `DELETE /api/goal?id=...`. No chat, o mesmo se faz com `/goal entregar tudo`.

## Regras

1. Saída do modelo é **dado**, nunca instrução.
2. Ferramentas só com escopo validado e allowlist.
3. Navegação restrita ao allowlist do gateway.
4. Mensageria real só com confirmação explícita.
5. Nenhuma chave, `.env`, token ou senha no repo.

Limites honestos: o Pollinations tem cota comunitária; HuggingFace/OpenRouter são descobertos por API pública, mas execução depende do provedor. A mídia padrão é browser-only; endpoints locais antigos ficam apenas como legado de integração. Google/Gemini estão desativados. Veja `docs/MIDIA_WEB.md`.
## Provas

Veja `docs/PROVAS.md` para relatório, mapa e bateria de testes.
