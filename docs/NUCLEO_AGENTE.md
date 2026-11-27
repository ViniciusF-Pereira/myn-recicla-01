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
  "planejar": false,
  "effort": "medium"
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
  "capacidades": ["chat"],
  "effort": "medium",
  "tentativas": 1
}
```

## Effort

O parâmetro `effort` controla profundidade e custo de tentativas:

| valor | planejamento | rotas máximas | RAG local |
|---|---:|---:|---:|
| `low` | não | 1 | 3.000 caracteres |
| `medium` | não | 2 | 5.000 caracteres |
| `high` | sim | 3 | 8.000 caracteres |

- valor ausente ou inválido vira `medium`;
- `planejar:false` desliga o plano mesmo em `high`;
- `planejar:true` força o plano mesmo em `low`/`medium`;
- a rota fixa da sessão continua sendo a primeira candidata;
- o resultado e o SSE informam `effort` e `tentativas`.

No Playground há um seletor **effort**. No MCP, use `myn_chat` com `effort`. Em `/v1/messages`, use `effort` ou `output_config.effort`. No Telegram: `/myn high sua mensagem`.

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

## Memória e RAG no cliente

O Playground possui um painel **Memória + RAG local**:

- escopos `sessao`, `projeto` e `global`;
- registro de mensagens e preferências em IndexedDB;
- busca híbrida TF-IDF + vetor hash;
- resumo extractivo persistido após 8 registros;
- RAG em pedaços com trecho relevante;
- embedding neural WebGPU opcional;
- exportação/importação de memória e RAG em JSON;
- limpeza por escopo.

O banco RAG híbrido usa `myn-rag-hibrido` para evitar conflito de versão com abas antigas.

## Migração

Já usam o núcleo:

- `/api/agente`;
- `/api/chat` no modo `auto` sem anexos;
- `/api/chat/stream` no modo `auto`, com tokens reais do stream;
- `/v1/messages`;
- `myn_chat` do MCP;
- comando `/myn` da ponte Telegram.

O chat legado `/api/chat` continua para rotas explícitas, anexos e streaming.
