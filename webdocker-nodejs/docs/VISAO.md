# WEBdocker.NODEJS — visão

O projeto roda **no aparelho de quem executa**. A imagem `myn-recyla-01` leva Node.js 22, Chromium headless, gateway mediado, site, RAG, mídia, scoreboard de rotas e MCP. Nada abre janela de navegador no host e nenhuma chave é necessária.

## Fluxo de distribuição
```
build.ps1  →  docker build -t myn-recyla-01
run.ps1    →  docker run -p 5188:5188 -v recyla-dados:/data
save/load  →  myn-recyla-01.tar para outra máquina
```

Cada pessoa executa o container localmente e acessa `http://127.0.0.1:5188`. As rotas ficam no dispositivo dela, não no PC de quem publicou.

## Por que container e não extensão
- Chromium headless com CDP local mantém o allowlist e o token curto.
- Volume `/data` guarda histórico, cache, arquivos e saúde entre reinícios.
- Não depende de login do navegador pessoal — o perfil é do container.
- Funciona em Windows, Linux e macOS com Docker.

## Limites
- Serviços free têm cota comunitária; o fallback local cobre imagem e vídeo.
- Rotas Google precisam de um login único no perfil do gateway.
- Mensageria exige confirmação explícita.
