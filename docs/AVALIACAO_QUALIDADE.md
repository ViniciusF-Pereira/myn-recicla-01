# Avaliação automática de qualidade

O Myn mede a qualidade das respostas por critérios objetivos.

## Critérios

- resposta não vazia;
- identidade correta do Myn;
- ausência de recusa/falha;
- código quando a tarefa é de código;
- fontes quando a tarefa é pesquisa;
- latência.

## Casos

- identidade;
- documentação;
- função JavaScript;
- pesquisa sobre workers.

## Como executar

```powershell
node scripts/avaliar-qualidade.mjs
```

Ou:

- `GET /api/avaliacao` — último relatório;
- `POST /api/avaliacao` — roda os casos.

Resultados ficam em `dados/avaliacao-qualidade.jsonl`.

## Último resultado

- identidade: 0.80;
- documentação: 0.80;
- código: 0.90;
- pesquisa: 0.85 via RAG local;
- **4/4 aprovados**.

## Limite

A nota é heurística e não substitui avaliação humana ou benchmarks de modelo. Ela serve para detectar regressões óbvias.
