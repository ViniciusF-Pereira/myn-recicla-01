# Prova de merge automático — Myn Recicla/01

Execução: 25/11/2026, worker de melhoria, `maxCiclos=8`, `intervaloMs=500`.

## Achados reproduzidos e corrigidos

| # | Achado | Arquivo | Teste do achado depois | Merge |
|---|---|---|---|---|
| 1 | `midia-path-traversal` (hardening de caminho) | `src/midia.mjs` | padrão removido | `true` |
| 2 | `tesseract-portavel-src-midia-mjs` | `src/midia.mjs` | não reproduz | `true` |
| 3 | `tesseract-portavel-src-gateway-mjs` | `src/gateway.mjs` | não reproduz | `true` |
| 4 | `tesseract-portavel-scripts-mapear-mjs` | `scripts/mapear.mjs` | não reproduz | `true` |
| 5 | `worker-escopo-commit` | `src/worker.mjs` | não reproduz | `true` |

Commits:

- `d636687` — `midia-path-traversal`
- `556f653` — Tesseract portável em `src/midia.mjs`
- `f0f9b93` — Tesseract portável em `src/gateway.mjs`
- `b099add` — Tesseract portável em `scripts/mapear.mjs`
- `ed34073` — commit limitado ao arquivo da tarefa

## Ressalva de qualidade

O achado de caminho em mídia foi um **hardening**, não um exploit confirmado: `seguro(nome)` já removia separadores antes do join. A auditoria atual reconhece padrões no fonte; ela ainda não substitui testes comportamentais de segurança.

## Resultado

- Auditoria final: **0 achados**.
- `node --test`: **17/17**.
- Nenhuma revisão humana intermediária.
- Nenhum envio de código para LLM.
- Todos os merges foram `--ff-only` e passaram pela allowlist de caminhos.
