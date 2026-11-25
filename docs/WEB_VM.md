# Sandbox web, DB local e agentes — Myn Recicla/01

**Nomes honestos:** é um **sandbox Web Worker** (não uma VM completa) e um **DB local IndexedDB, espelhável em SQLite** (não é SQLite rodando no navegador).

Camada 100% browser: nada roda no PC do usuário além do navegador.

## DB leve
`web/db/leve.mjs` — **DB local em IndexedDB, espelhável em SQLite** (tabelas `eventos`, `metricas`, `agentes`, `cache`, `arquivos`, `sessoes`). Exporta `inserir`, `listar`, `obter`, `contar`, `limpar`, `exportar`, `importar`. Não é SQLite no navegador; o formato de exportação pode ser migrado para SQLite quando hospedado.

## VM web escalável
`web/vm/vm.mjs` — **sandbox em Web Worker** (isolamento de worker, não uma VM de sistema), com:
- `executar(op, args)` — `eco`, `soma`, `mapa`, `hash`, `analisar`;
- HD virtual em IndexedDB (`gravar`, `HD`);
- cache próprio (`gravarCache`, `cache`);
- sessões persistidas.

## Agentes avaliadores
`web/agentes/avaliadores.mjs` — três agentes: **Auditor** (correção/segurança), **Desempenho** (velocidade/memória), **Inteligência** (clareza/arquitetura). Usam WebLLM/WebGPU quando disponível; senão rotas free do Myn. Cada avaliação é gravada em `metricas`.

## Interface
Playground → botões **VM** e **agentes** abrem painéis com execução, HD, cache e avaliação de código. Rodapé **Created By** com GitHub e campo LinkedIn editável.

## Created By
`site/sessao.mjs` — persistência da sessão do autor. LinkedIn não foi encontrado em `D:\2 - Pessoal` e ficou editável na interface (não foi inventado).
