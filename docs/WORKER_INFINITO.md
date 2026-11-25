# Worker infinito — Myn Recicla/01

Agente autônomo que melhora o próprio projeto usando **rotas free do Myn**, com cada etapa visível em streaming no Playground.

## Prompt estruturado

```
Você é o Myn Recicla, agente de código. Melhore este projeto: {objetivo}
Responda SOMENTE JSON:
{"arquivo":"docs/EVOLUCAO.md","modo":"append","conteudo":"..."}
Arquivos permitidos: docs/*.md, src/*.mjs, scripts/*.mjs, config/*.json.
Sem texto fora do JSON.
```

Regras do prompt:
- saída é **dado**, nunca instrução;
- escopo rígido por regex (`PERMITIDO`);
- patch inválido → fallback determinístico (registro de saúde/objetivo em `docs/EVOLUCAO.md`);
- nunca tocar `dados/`, `outputs/`, `.git/`, segredos.

## Loop (máquina de estados)

```
iniciado → ciclo_n → planejar (rotas free)
        → branch worker/auto
        → higienizar (tmp-*, paleta-* no workspace)
        → patch (modelo via Pollinations/OpenRouter, fallback determinístico)
        → aplicar patch (append/replace)
        → testes (node --check + git diff --check)
        → se falhar: revert + evento "revertido"
        → se passar: commit → checkout master → merge --ff-only
        → próximo ciclo (intervalo configurável, abortável)
        → finalizado (parar/limite)
```

Eventos SSE: `conectado`, `iniciado`, `ciclo_inicio`, `plano`, `branch`, `higienizacao`, `patch`, `testes`, `git`, `erro`, `revertido`, `parando`, `finalizado`.

## Endpoints
- `GET /api/worker/stream` — SSE ao vivo
- `POST /api/worker/start` — `{objetivo, maxCiclos, intervaloMs, autoMerge}`
- `POST /api/worker/stop`
- `GET /api/worker/status`

## Segurança
- branch isolada `worker/auto`; merge só `fast-forward` e só após testes;
- `git add -A` nunca inclui `dados/` nem `outputs/` (gitignore);
- merge com conflito → `git merge --abort` e evento de falha;
- STOP imediato via AbortController lógico;
- sem shell: `execFile('git', [...])` com args separados.

## Visual
Playground → botão **worker** abre painel com log escuro, cor por tipo de evento, campo de objetivo, INICIAR/PARAR. Cada etapa aparece com timestamp.

## Privacidade do engenheiro (25/11/2026)
- O worker **não usa o chat da interface nem o orquestrador** para gerar patches. Ele faz POST direto a `https://text.pollinations.ai/openai`.
- O envio contém trechos de código do arquivo-alvo e testes relacionados, mais instruções pedindo um patch JSON. Não envia fotos.
- O evento `proposta` mostra endpoint, modelo, quantidade de caracteres, trechos e testes enviados.
- Use apenas código público/open-source. Para impedir qualquer envio externo, defina `MYN_ENGENHARIA_ATIVO=0`; o worker continua vigiando o backlog local.

## Engenharia contínua (25/11/2026)
- **Análise** mede quatro frentes: código/arquivos, desempenho no fio, modelos livres e grafo de dependências.
- **Melhoria** aplica o backlog verificável. Com backlog vazio, espera 2 minutos e pede ao Pollinations (`openai-fast`) uma proposta de patch para código, infra, modelos ou arquitetura.
- Toda proposta passa por validação de escopo, `node --test`, `node --check` e `git diff --check`. Código fica em `worker/auto`; nunca é mergeado automaticamente.
- O merge de docs/config exige que **todo o diff `master...worker/auto`** seja docs/config. Uma tarefa de docs não pode arrastar código anterior.
- Descoberta de modelos: `node scripts/descobrir-modelos.mjs` (Pollinations, OpenRouter, HuggingFace; sem chave e sem Google).

## Dois workers separados (25/11/2026)
- **Análise** (`src/worker-analise.mjs`): só observa — varrimento de arquivos, saúde, backlog e achados. Nunca edita nem commita. Endpoints `/api/worker-analise/{status,start,stop,stream}`.
- **Melhoria** (`src/worker-melhoria.mjs`): aplica tarefa real do backlog, testa, commita e faz merge. Quando o backlog acaba, fica em `aguardando` (vigia) em vez de inventar trabalho. Código permanece em `worker/auto` para revisão; só docs/config têm merge automático. Endpoints `/api/worker-melhoria/{status,start,stop,stream}`.
- **Desempenho**: `src/desempenho.mjs` mede bytes no fio, p50 e 304 via ETag. `node scripts/medir.mjs` roda a auditoria; `/api/desempenho` expõe o JSON. Gzip, ETag/304 e cache de `config/modelos.json` reduziram a soma medida de 173,5 KB para 41,8 KB.

## Backlog dinâmico (correção 25/11/2026)
O worker antigo repetia uma linha em `docs/EVOLUCAO.md` e gerava commits sem melhoria real. Foi substituído por `src/analise.mjs`: a cada ciclo ele lê o projeto, encontra lacunas reais (scripts, docs, exports, config) e gera uma tarefa verificável. `docs/MELHORIAS_APLICADAS.json` guarda o que já foi feito, evitando repetição. Quando não há pendências, ele emite `sem_tarefas` e para de commitar.

## Validação real (25/11/2026)
- Teste via SSE: 17 eventos em 2 ciclos: `conectado → iniciado → ciclo_inicio → plano → branch → higienizacao → patch → testes → git → ... → finalizado`.
- Teste no navegador: 23 linhas no painel, sem erros de console.
- Git: commits `worker: ciclo N — melhorar e otimizar o codigo do Myn Recicla` com merge automático em `master`.
- Correção aplicada: `AbortController.abort()` (não `.cancel()`) para reconectar o stream.
- STOP via `POST /api/worker/stop` funcionando.
