# Supervisor de 6 horas

O supervisor observa mensagens novas do Telegram e do chat do Myn.

## O que ele verifica

- pedidos vagos demais;
- ações destrutivas;
- mensageria sem confirmação;
- uso de Google/Gemini;
- pedido de código sem arquivo ou teste.

## O que ele faz

- registra cada crítica em `dados/supervisor-eventos.jsonl`;
- envia a crítica ao Telegram;
- mantém o worker de melhoria ativo;
- não aplica patch arbitrário sem pedido explícito.

## Pedido explícito de código

Use:

```
/melhorar src/stream.mjs | corrigir o cálculo de timeout
```

O pedido entra em `dados/pedidos-melhoria.jsonl`. O worker:

1. gera uma proposta com Pollinations;
2. valida o trecho exato;
3. aplica em `worker/auto`;
4. roda `node --test`, sintaxe e diff;
5. commita;
6. mergeia se passar pela allowlist e no smoke.

## Controle

- `GET /api/supervisor/status`
- `POST /api/supervisor/start` — inicia 6 horas.
- `POST /api/supervisor/stop`
- `MYN_SUPERVISOR_ATIVO=0` impede início automático.
