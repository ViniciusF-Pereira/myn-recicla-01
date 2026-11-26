# Rota local de agente — token, MCP e Anthropic Messages

O Myn Recicla/01 pode ser usado como rota de agente por outro programa no mesmo computador.

## 1. Emitir o token

Com o site rodando:

```powershell
npm run token
# ou: node scripts/emitir-token.mjs
```

O token fica em `dados/token-local.json`, fora do Git, com validade de 30 dias. Também pode ser lido por:

```powershell
curl http://127.0.0.1:5188/api/token
```

Para renovar:

```powershell
curl -X POST http://127.0.0.1:5188/api/token/renovar
```

Não compartilhe o token. Ele dá acesso à rota local.

## 2. Conectar por MCP

Endpoint:

```
POST http://127.0.0.1:5188/mcp
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

Exemplo de configuração genérica:

```json
{
  "mcpServers": {
    "myn-recicla": {
      "url": "http://127.0.0.1:5188/mcp",
      "headers": { "Authorization": "Bearer SEU_TOKEN" }
    }
  }
}
```

Ferramentas disponíveis: chat, pesquisa, rotas, plugin, imagem, áudio, vídeo, documento, histórico e mensagem.

## 3. Rota estilo Anthropic Messages

Endpoint:

```
POST http://127.0.0.1:5188/v1/messages
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

Requisição:

```json
{
  "model": "myn-auto",
  "max_tokens": 1024,
  "thinking": { "type": "enabled", "budget_tokens": 512 },
  "messages": [
    { "role": "user", "content": "Explique o que é o Myn Recicla/01." }
  ]
}
```

Resposta compatível com o formato de mensagem:

```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "model": "myn-auto",
  "content": [
    { "type": "thinking", "thinking": "Classifiquei a tarefa...", "signature": "local-..." },
    { "type": "text", "text": "Sou o Myn Recicla/01..." }
  ],
  "stop_reason": "end_turn",
  "usage": { "input_tokens": 42, "output_tokens": 80 }
}
```

O bloco `thinking` é um **resumo de alto nível do loop local**, não cadeia de pensamento oculta.

### Streaming

Use `"stream": true`. O endpoint envia eventos:

- `message_start`
- `content_block_start`
- `content_block_delta`
- `content_block_stop`
- `message_delta`
- `message_stop`

### Ferramentas

Ao enviar `tools`, o endpoint pode responder com `content[].type = "tool_use"` e `stop_reason = "tool_use"`. O agente executa a ferramenta e devolve um bloco `tool_result` na próxima mensagem.

## 4. Segurança

- O endpoint de token só responde para loopback (`127.0.0.1`/`::1`).
- Para exigir autenticação em `/mcp` e `/v1/messages`, inicie com `MYN_EXIGIR_TOKEN_AGENTE=1`.
- Sem essa variável, o token é opcional para compatibilidade local.
- Validação executada: sem token e com exigência ativa → 401; com token válido → 200.
- Se publicar a porta em Docker/rede, use firewall e obrigatoriamente `MYN_EXIGIR_TOKEN_AGENTE=1`.
- Nunca coloque o token em `site/`, `config/`, commits ou prints públicos.
