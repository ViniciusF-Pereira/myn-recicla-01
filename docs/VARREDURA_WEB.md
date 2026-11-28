# Varredura web testável

Meta ajustada pelo operador: **9.000.000 sites** (`--meta`, padrão `9000000`).

## O que existe

- `scripts/varredura-web.py`: coleta e teste retomável em SQLite.
- Fontes: listas públicas do GitHub, Tranco, Open Page Rank (10 milhões), sementes de lojas e Common Crawl.
- Teste concorrente com timeout, User-Agent identificado e sem contorno de CAPTCHA/login.
- Classificação: chat sem login, gerador sem login, loja/atendimento, login, paywall, bloqueado, rate-limit, indisponível e sem sinal.
- Saída: `outputs/varredura-web-resumo.json` e `dados/varredura-web/varredura.sqlite3`.

## Evidência histórica

- Coleta inicial: 9.833 URLs.
- Primeiro lote: 9.000 tentativas em 358 s.
- Coleta ampliada: 29.003 URLs únicas.
- Segundo lote: 20.003 tentativas em 934 s.
- Tranco `947L2`: 500.000 domínios processados, 499.985 URLs novas.
- Total coletado: **534.203 URLs únicas**.
- Lote de 500.000 testes iniciado com 128 workers e timeout de 6 s.
- Último total concluído antes desse lote: **29.003 tentativas**, sendo **24.749 respostas HTTP classificadas** e **4.254 erros de rede**.
- Classes: 9.490 sem sinal; 5.750 loja/atendimento; 2.821 paywall; 2.562 bloqueados; 1.481 chats sem login; 1.359 login; 769 geradores; 517 indisponíveis.

> Esses números são o registro anterior à correção da classificação e das proteções SSRF. O lote em andamento não foi revalidado nesta alteração; as classes históricas não devem ser comparadas diretamente com resultados novos.

## Comandos

```powershell
python scripts/varredura-web.py --collect --max-repos 600 --meta 9000000
python scripts/varredura-web.py --tranco --tranco-limit 500000 --meta 9000000
python scripts/varredura-web.py --openpagerank --openpagerank-limit 9000000 --meta 9000000
python scripts/varredura-web.py --commoncrawl --cc-tlds com,net,org --cc-pages 100 --cc-page-size 100 --meta 9000000
python scripts/varredura-web.py --test --limit 20000 --workers 96 --timeout 8 --meta 9000000
python scripts/varredura-web.py --meta 9000000
```

`--meta` é opcional e já vale `9000000` quando omitido. A meta não cria URLs nem executa testes: ela apenas define o denominador do progresso.

### Validação offline

```powershell
python -m unittest discover -s tests -p "test_varredura_web.py" -v
python -m py_compile scripts/varredura-web.py tests/test_varredura_web.py
```

Os testes usam SQLite temporário e DNS simulado; não fazem coleta nem requisições de rede.

## Proteções e limites reais

- **Inserção correta:** `INSERT OR IGNORE` retorna novo somente quando `cursor.rowcount == 1`; duplicados não inflam `urls_novas`, mesmo após outras inserções.
- **Status antes do corpo:** `429` é `rate-limit`; `401/403` são `bloqueado`; `404/410` e erros `>=500` são `indisponivel`; demais erros HTTP também são indisponíveis.
- **Heurística somente em sucesso:** o corpo só alimenta sinais em respostas `2xx`. Scripts, estilos, comentários, templates e tags são removidos antes das heurísticas; corpos de `HTTPError` não geram paywall/login/captcha.
- **SSRF nas entradas:** somente HTTP(S), sem credenciais; localhost, nomes sem domínio, sufixos internos/reservados e literais IP não públicos são recusados.
- **SSRF no DNS e nos saltos:** todos os endereços resolvidos precisam ser públicos; falha de resolução bloqueia o pedido. Cada redirecionamento é validado antes de abrir o destino seguinte, inclusive nas coletas.
- **Progresso verificável:** `tentativas` conta registros reais em estado `testado` ou `erro`. `meta_atingida` só é verdadeiro com URL no banco e tentativas suficientes; estar na fila não conta como concluído.
- **Retomada:** `--limit`, `--tranco-limit`, `--cc-pages` e `--cc-page-size` continuam limitando cada rodada. O SQLite com WAL preserva fila e resultados; a meta não elimina esses limites nem simula um lote.

## Fontes

- GitHub: listas públicas awesome-free-ai-tools e diretórios relacionados.
- Tranco: lista permanente `https://tranco-list.eu/top-1m.csv.zip`, ID `947L2`.
- Open Page Rank: `https://openpagerank.keywordseverywhere.com/downloads/top10milliondomains.csv.zip`, lista de outubro/2026; ZIP cacheado em `dados/varredura-web/`.
- Common Crawl: índice `CC-MAIN-2026-43`.

## Limites

- HTTP 200 e sinais de texto não provam que um chat ou gerador completa uma geração.
- A classificação é triagem, não verificação humana final.
- Sites podem mudar layout, exigir login ou impor cota depois do teste.
- O Common Crawl pode responder 503/limitar requisições; o banco permite retomar depois.
- A validação DNS é fail-closed, mas não elimina uma corrida de rebinding entre a validação e a conexão nem o comportamento de um proxy de ambiente. Não execute o script em rede sem confiar no resolvedor/proxy local.
