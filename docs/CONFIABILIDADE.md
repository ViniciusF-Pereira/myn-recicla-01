# Confiabilidade das rotas

O Myn aplica proteções locais antes de chamar serviços externos.

## Rate limit

- balde por rota/modelo;
- padrão de 30 chamadas por minuto;
- respostas locais não consomem cota externa.

## Retry

- até 2 tentativas para HTTP 429/503;
- espera mínima de 10 segundos;
- respeita `Retry-After` quando presente.

## Circuit breaker

- abre após 3 falhas consecutivas;
- permanece aberto por 60 segundos;
- permite uma tentativa de recuperação;
- fecha após sucesso.

## Observabilidade

- `GET /api/confiabilidade`
- evento `confiabilidade` no worker de análise
- contagem de baldes e circuitos abertos na home/Playground.

## Validação executada

- `/mcp` sem token → 401; com token → 200.
- `/v1/messages` sem token → 401; com token → 200.
- Chamada real via `/api/agente` registrou 1 balde e circuito `closed`.
- Resposta obtida via `pollinations:openai-fast`.

## Autenticação

- `/mcp` e `/v1/messages` exigem token por padrão.
- `MYN_EXIGIR_TOKEN_AGENTE=0` desativa apenas para compatibilidade local.
- O WORK renova automaticamente o token via `/api/token`.
