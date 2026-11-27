# Núcleo único do agente

`src/nucleo.mjs` centraliza o fluxo que antes ficava espalhado entre chat, MCP e integrações.

## Fluxo

```
mensagem
→ registro na memória
→ conhecimento local do produto
→ memória recente e relacionada
→ classificação de capacidades
→ plano opcional
→ RAG quando for pesquisa
→ rota free
→ resposta
→ registro na memória
```

## API

### `POST /api/agente`

```json
{
  "mensagem": "explique o Myn",
  "sessao": "usuario-1",
  "canal": "telegram",
  "rota": "auto",
  "planejar": false
}
```

Retorna:

```json
{
  "resposta": "...",
  "via": "conhecimento-local",
  "sessao": "usuario-1",
  "passos": ["..."],
  "fontes": [],
  "capacidades": ["chat"]
}
```

### Memória

- `GET /api/memoria?sessao=usuario-1&q=termo`
- `POST /api/memoria` com `{ "chave": "voz", "valor": "pt-BR", "sessao": "usuario-1" }`

A memória é JSONL em `dados/memoria.jsonl`, fora do Git.

## Migração

Já usam o núcleo:

- `/api/agente`;
- `/v1/messages`;
- `myn_chat` do MCP;
- comando `/myn` da ponte Telegram.

O chat legado `/api/chat` ainda existe para compatibilidade e será migrado depois.
