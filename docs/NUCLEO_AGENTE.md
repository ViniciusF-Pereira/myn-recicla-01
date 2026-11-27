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

### Afinidade de rota por conversa

Cada sessão mantém a rota que funcionou:

1. o núcleo lista rotas compatíveis;
2. APIs são tentadas antes dos navegadores;
3. a primeira rota com resposta válida vira a rota da sessão;
4. as próximas mensagens tentam essa rota primeiro;
5. se ela falhar, o Myn tenta outra rota/modelo/navegador;
6. a preferência fica em `dados/memoria.jsonl`.

O Playground cria um `myn-chat-session` por aba. MCP, Anthropic e Telegram também podem enviar um `sessao`/`user_id`.

## Memória

- `GET /api/memoria?sessao=usuario-1&q=termo`
- `POST /api/memoria` com `{ "chave": "voz", "valor": "pt-BR", "sessao": "usuario-1" }`

A memória é JSONL em `dados/memoria.jsonl`, fora do Git.

A busca combina:

- overlap lexical;
- vetor hash local com similaridade por cosseno;
- recência;
- resumo extractivo para conversas com mais de 8 registros.

O vetor hash é uma assinatura lexical local, não um embedding neural. A camada browser também possui embeddings WebGPU em `web/inferencia/embeddings-gpu.mjs`.

## Migração

Já usam o núcleo:

- `/api/agente`;
- `/api/chat` no modo `auto` sem anexos;
- `/api/chat/stream` no modo `auto`, com tokens reais do stream;
- `/v1/messages`;
- `myn_chat` do MCP;
- comando `/myn` da ponte Telegram.

O chat legado `/api/chat` continua para rotas explícitas, anexos e streaming.
