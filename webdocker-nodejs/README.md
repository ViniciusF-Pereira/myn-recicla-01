# WEBdocker.NODEJS

Container portátil do **Myn — Recyla/01**. As rotas rodam **no aparelho de quem executa**, não num PC central: cada pessoa baixa/roda a imagem e ganha gateway Chromium **headless** + site + APIs na própria máquina. Nada abre janela de navegador.

## O que sobe dentro
- **Chromium headless** com CDP local (porta 9333 interna) e allowlist de domínios.
- **Gateway mediado** (porta 36877) com token curto (30 min) e operações nomeadas.
- **Site + APIs** (porta 5188): chat com streaming, pesquisa, 62 plugins, mídia, histórico/cache, agregador Google.
- **RAG**, **scoreboard de rotas** (circuit breaker) e **MCP** JSON-RPC.
- Volume `/data` com histórico, cache, arquivos e scoreboard — persiste entre reinícios.

## Build (uma vez)
```powershell
cd "D:\0 - Projetos\Myn-Portable"
docker build -t myn-recyla-01 .
```

## Rodar no aparelho da pessoa
```powershell
docker run -d --name myn-recyla-01 `
  -p 5188:5188 `
  -v recyla-dados:/data `
  myn-recyla-01
```
Abra `http://127.0.0.1:5188`. Para o terminal do container (debug):
```powershell
docker exec -it myn-recyla-01 bash
```

## Distribuir
```powershell
docker save myn-recyla-01 -o myn-recyla-01.tar
# na outra máquina:
docker load -i myn-recyla-01.tar
docker run -d --name myn-recyla-01 -p 5188:5188 -v recyla-dados:/data myn-recyla-01
```

## Verificação dentro do container
```powershell
docker exec myn-recyla-01 node -e "fetch('http://127.0.0.1:5188/api/plugins').then(r=>r.json()).then(d=>console.log('plugins',d.total))"
docker exec myn-recyla-01 node -e "fetch('http://127.0.0.1:5188/api/saude').then(r=>r.json()).then(d=>console.log('saude',d.rotas.length))"
```

## Regras
Sem chave de API, sem serviço pago, sem cookie/senha gravada. Mensageria (Google Chat, Messages, Telegram, WhatsApp, Discord) exige confirmação explícita (`confirmar=true`). Navegação restrita ao allowlist do gateway.
