# Ponte Telegram ↔ WORK

A ponte usa o Bot API do Telegram e fica ativa junto com o servidor do Myn. Por padrão, as mensagens são injetadas em uma sessão real do OpenCode e a resposta volta ao Telegram. Use `/myn texto` para conversar diretamente com o Myn.

## Configuração local

Crie `dados/telegram-token.json`:

```json
{
  "token": "TOKEN_DO_BOTFATHER",
  "allowedUserId": 6625938275
}
```

O arquivo fica fora do Git. Nunca coloque o token em `config/`, `site/`, docs ou commits.

A sessão do OpenCode fica em `dados/opencode-session.json`:

```json
{
  "sessionID": "ses_...",
  "bin": "C:/Users/Vini/.opencode/bin/opencode.exe"
}
```

O CLI do OpenCode usa a descoberta e autenticação da própria máquina. Não é necessário guardar token do OpenCode nesse arquivo.

No Docker, o alvo padrão é `myn` porque a imagem não inclui o CLI/sessão do OpenCode. Para usar OpenCode em container, seria necessário montar o binário e a configuração autenticada.

## Comandos

- `/start` ou `/ajuda` — apresentação e comandos.
- `/status` — workers e arquitetura.
- `/opencode` — sessão atual do OpenCode.
- `/myn texto` — conversa direta com o Myn.
- `/worker` — estado do worker de melhoria.
- `/melhorar src/arquivo.mjs | descreva a correção` — pedido de código que o worker testa antes de aplicar.
- Fotos e documentos — são baixados, enviados ao `/api/documento` e respondidos com OCR/arquivo.
- Imagens geradas pelo Myn são enviadas como `sendPhoto`, não como markdown.
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

A ponte conecta o Telegram à sessão do OpenCode configurada em `dados/opencode-session.json`. As mensagens entram nessa sessão e a resposta do agente volta ao Telegram. `/myn` mantém o caminho alternativo para o Myn.
