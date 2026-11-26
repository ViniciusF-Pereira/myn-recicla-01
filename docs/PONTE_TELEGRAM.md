# Ponte Telegram ↔ WORK

A ponte usa o Bot API do Telegram e fica ativa junto com o servidor do Myn.

## Configuração local

Crie `dados/telegram-token.json`:

```json
{
  "token": "TOKEN_DO_BOTFATHER",
  "allowedUserId": 6625938275
}
```

O arquivo fica fora do Git. Nunca coloque o token em `config/`, `site/`, docs ou commits.

## Comandos

- `/start` ou `/ajuda` — apresentação e comandos.
- `/status` — workers e arquitetura.
- `/worker` — estado do worker de melhoria.
- `/melhorar src/arquivo.mjs | descreva a correção` — pedido de código que o worker testa antes de aplicar.
- Fotos e documentos — são baixados, enviados ao `/api/documento` e respondidos com OCR/arquivo.
- Qualquer texto — conversa com o Myn/Work.

## Supervisor de 6h

O supervisor acompanha novas mensagens do Telegram e do chat, critica riscos e mantém o worker de melhoria ativo. Ele avisa quando uma ideia é vaga, destrutiva, sem confirmação ou sem critério de teste.

A ponte também envia notificações de:

- achado de código;
- melhoria aplicada;
- merge bloqueado;
- patch revertido;
- tarefa bloqueada.

## Endpoint local

- `GET /api/telegram/status`
- `POST /api/telegram/enviar` com `{ "texto": "..." }`

Os endpoints só respondem para loopback.

## Segurança

- O token foi compartilhado no chat e deve ser revogado/rotado no BotFather.
- Depois de girar o token, atualize somente `dados/telegram-token.json`.
- A ponte aceita mensagens apenas do `allowedUserId`.

## Limite

A ponte conecta o Telegram ao **Myn/WORK** e às notificações dos workers. Ela não injeta mensagens diretamente em uma sessão do OpenCode; para isso seria necessária uma integração autenticada com a API/sessão do OpenCode.
