# Workers do Myn Recicla/01

O projeto tem dois workers observáveis em SSE na home e no Playground.

## 1. Análise — `/api/worker-analise/*`

Só lê e mede. Nunca edita nem commita.

- varre arquivos, linhas, exports e TODO/FIXME;
- mede latência p50, bytes no fio, gzip e 304 via ETag;
- descobre modelos livres (Pollinations, OpenRouter, HuggingFace);
- audita o grafo de imports (ciclos, dependências invertidas, imports quebrados);
- audita código/infra com achados reproduzíveis (`src/auditoria-codigo.mjs`).

## 2. Melhoria — `/api/worker-melhoria/*`

Fluxo atual:

```
backlog verificável → patch → node --test → node --check → diff --check
                    → commit em worker/auto → merge fast-forward
backlog vazio → auditoria de código → achado reproduzido → patch mínimo
              → confirmar que o achado sumiu → testes → commit → merge
sem achado → aguardando (não inventa trabalho)
```

Correções determinísticas são aplicadas sem LLM. Achados sem patch determinístico são apenas sinalizados; nenhum código é enviado para fora.

## Merge automático sem revisão humana

O merge de código está ativo por padrão e pode ser desligado com `MYN_AUTO_MERGE_CODIGO=0`.

Allowlist de caminhos:

- `docs/*`, `config/*`;
- `src/*`, `scripts/*`, `tests/*`, `web/*`, `site/*`;
- `Dockerfile`, `docker-compose.yml`, `package.json`.

Antes do merge, o worker verifica **todo o diff `master...worker/auto`**. Qualquer caminho fora da allowlist bloqueia o merge. Segredos, `dados/`, `outputs/` e `.git/` nunca são permitidos.

O merge é sempre `--ff-only`. Se houver conflito ou falha, a branch permanece para inspeção.

## Endpoints

- `GET /api/worker-analise/{status,stream}`
- `POST /api/worker-analise/{start,stop}`
- `GET /api/worker-melhoria/{status,stream}`
- `POST /api/worker-melhoria/{start,stop}`

## Eventos principais

`conectado`, `iniciado`, `ciclo_inicio`, `arquivos`, `saude`, `desempenho`, `modelos`, `arquitetura`, `codigo`, `backlog`, `achado`, `patch`, `testes`, `revertido`, `merge_bloqueado`, `engenharia_aplicada`, `git`, `aguardando`, `finalizado`.

## Propostas por LLM (experimental, desativado no fluxo padrão)

`src/engenheiro.mjs` ainda existe como experimento. Ele não é chamado pelo worker atual. Se for reativado, o envio externo deve ser opt-in via `MYN_ENGENHARIA_ATIVO=1` e deve receber um achado/teste concreto, não um pedido genérico de “melhore o arquivo”.

## Evidências

- Desempenho: `node scripts/medir.mjs` e `GET /api/desempenho`.
- Modelos: `node scripts/descobrir-modelos.mjs` e `GET /api/modelos/descobertos`.
- Arquitetura: `GET /api/arquitetura` e `tests/arquitetura.test.mjs`.
- Docker: [`DOCKER_VALIDACAO.md`](DOCKER_VALIDACAO.md).
