# API comercial — Myn Recicla/01

A API é auto-hospedada. Você controla dados, chaves, planos e cobrança.

## 1. Criar uma chave

Abra `http://127.0.0.1:5188/api.html`. O painel usa o token local e só funciona em loopback.

Ou pela API admin:

```bash
TOKEN=$(curl -s http://127.0.0.1:5188/api/token | jq -r .token)

curl http://127.0.0.1:5188/api/admin/chaves \
  -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{"nome":"app do cliente","plano":"pro"}'
```

A resposta traz `chave` **uma única vez**. O arquivo `dados/api-chaves.json` guarda apenas o hash SHA-256.

## 2. Consumir

```bash
curl http://127.0.0.1:5188/v1/agent \
  -H "Authorization: Bearer $MYN_API_KEY" \
  -H 'content-type: application/json' \
  -d '{"message":"Explique o Myn","session":"app-1","effort":"medium"}'
```

Resposta:

```json
{
  "resposta": "...",
  "via": "conhecimento-local",
  "effort": "medium",
  "tentativas": 1,
  "uso": { "usado": 1, "limite": 10000, "restante": 9999, "rpm": 120 }
}
```

## 3. Planos

| Plano | Requisições/dia | RPM | Effort |
|---|---:|---:|---|
| `gratuito` | 100 | 10 | low, medium |
| `pro` | 10.000 | 120 | low, medium, high |

Edite `config/planos-api.json`. A cota é renovada por dia UTC.

## 4. Uso e métricas

- `GET /v1/usage` — uso da própria chave.
- `GET /api/admin/metricas` — p50, p95, falhas e total (admin local).
- `GET /api/admin/chaves` — lista redigida.
- `DELETE /api/admin/chaves/:id` — revogação imediata.

## 5. SDK

```js
import { Myn } from './sdk/myn.mjs';

const myn = new Myn({
  baseUrl: 'https://api.seudominio.com',
  apiKey: process.env.MYN_API_KEY,
});

const resposta = await myn.agent({ message: 'Olá', effort: 'high' });
const uso = await myn.usage();
```

## 6. Webhook

Configure no servidor:

```powershell
$env:MYN_API_WEBHOOK_URL='https://seu-servico.com/webhook'
$env:MYN_API_WEBHOOK_SECRET='segredo-longo'
```

Eventos:

- `chave.criada`;
- `chave.revogada`;
- `uso.registrado`;
- `cota.excedida`.

O corpo é JSON. Quando há segredo, o cabeçalho `x-myn-signature` contém `sha256=<HMAC-SHA256>`. Valide com comparação de tempo constante.

## 7. Erros

| HTTP | Código | Significado |
|---:|---|---|
| 401 | `authentication_error` | chave ausente, inválida, expirada ou revogada |
| 403 | `effort_not_allowed` | plano não permite o esforço |
| 429 | `rate_limit` | RPM excedido |
| 429 | `quota_exceeded` | cota diária excedida |
| 500 | `api_error` | falha interna |

## 8. OpenAPI

Contrato em `docs/openapi.yaml`.

## Aceite executado

- criação de chave: `200`, segredo exibido uma vez;
- `POST /v1/agent`: `200`, `effort=low`, uso `1/100`;
- `GET /v1/usage`: `200`, restante `99`;
- revogação: `200`;
- uso após revogação: `401 authentication_error`;
- requisição sem chave: `401 authentication_error`;
- painel `api.html`: carregado sem erros no console.

## Limites

- O painel admin é apenas loopback e exige o token local.
- Não há gateway de pagamento embutido; use o webhook para integrar cobrança.
- Em produção, use HTTPS, proxy reverso, firewall e backup de `dados/`.
- Rate limit e cota são locais ao processo; para múltiplas instâncias, use um contador externo.
