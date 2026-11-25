# VM web, DB leve e agentes — Myn Recicla/01

Camada 100% browser: nada roda no PC do usuário além do navegador.

## DB leve
`web/db/leve.mjs` — IndexedDB com esquema compatível com SQLite (tabelas `eventos`, `metricas`, `agentes`, `cache`, `arquivos`, `sessoes`). Exporta `inserir`, `listar`, `obter`, `contar`, `limpar`, `exportar`, `importar`. Pode ser espelhado no servidor no futuro.

## VM web escalável
`web/vm/vm.mjs` — Web Worker isolado (sandbox), com:
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
