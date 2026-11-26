# Prova de pedido explícito de melhoria

Pedido: `ped-ad0a6b472169`

Objetivo:

> remover o parâmetro staleMs não utilizado sem alterar o comportamento do lock

Fluxo executado pelo worker:

1. pedido recebido;
2. proposta gerada por `gpt-oss-20b` via Pollinations;
3. patch aplicado em `src/lock.mjs`;
4. `node --test`: 31/31;
5. commit `480d43f`;
6. merge automático em `master`;
7. push para o GitHub.

Patch:

```diff
-export async function adquirirLock(nome, { staleMs = 5 * 60_000 } = {}) {
+export async function adquirirLock(nome) {
```

Nenhum arquivo fora da allowlist foi alterado.
