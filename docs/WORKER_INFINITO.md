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

## Backlog dinâmico (correção 25/11/2026)
O worker antigo repetia uma linha em `docs/EVOLUCAO.md` e gerava commits sem melhoria real. Foi substituído por `src/analise.mjs`: a cada ciclo ele lê o projeto, encontra lacunas reais (scripts, docs, exports, config) e gera uma tarefa verificável. `docs/MELHORIAS_APLICADAS.json` guarda o que já foi feito, evitando repetição. Quando não há pendências, ele emite `sem_tarefas` e para de commitar.

## Validação real (25/11/2026)
- Teste via SSE: 17 eventos em 2 ciclos: `conectado → iniciado → ciclo_inicio → plano → branch → higienizacao → patch → testes → git → ... → finalizado`.
- Teste no navegador: 23 linhas no painel, sem erros de console.
- Git: commits `worker: ciclo N — melhorar e otimizar o codigo do Myn Recicla` com merge automático em `master`.
- Correção aplicada: `AbortController.abort()` (não `.cancel()`) para reconectar o stream.
- STOP via `POST /api/worker/stop` funcionando.
