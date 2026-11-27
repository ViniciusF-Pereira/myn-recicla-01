# Gateway e recuperação

O gateway controla navegadores reais por um token local.

## Diagnóstico

- `GET /api/gateway/status` — token, expiração e último erro.
- O cliente detecta capability expirada antes da chamada.
- HTTP 401 também dispara recuperação.

## Recuperação automática

Configure um comando que reinicie/renove o gateway:

```powershell
$env:MYN_GATEWAY_RECOVER_CMD="node scripts/meu-gateway.mjs"
```

Ou, para o gateway headless incluído no projeto:

```powershell
$env:MYN_GATEWAY_AUTO_START="1"
$env:MYN_GATEWAY_TOKEN_FILE="C:/caminho/token.json"
```

O Myn executa o comando, aguarda até 10 segundos pelo token e tenta a rota novamente.

## Recuperação manual

```powershell
curl -X POST http://127.0.0.1:5188/api/gateway/recuperar
```

## Segurança

- endpoints de status/recuperação aceitam apenas loopback;
- o token nunca é retornado por `/api/gateway/status`;
- comandos de recuperação são explicitamente configurados.
