# Varredura web testável

Meta histórica solicitada: **9.000.000 sites** (`--meta`, padrão `9000000`). Decisão atual do operador: **coleta de novas URLs encerrada**; os testes continuam na fila existente.

## O que existe

- `scripts/varredura-web.py`: coleta e teste retomável em SQLite.
- Fontes: listas públicas do GitHub, Tranco, Open Page Rank (10 milhões), sementes de lojas e Common Crawl.
- Teste concorrente com timeout, User-Agent identificado e sem contorno de CAPTCHA/login.
- Classificação: chat sem login, gerador sem login, loja/atendimento, login, paywall, bloqueado, rate-limit, indisponível e sem sinal.
- Saída: `outputs/varredura-web-resumo.json` e `dados/varredura-web/varredura.sqlite3`.

## Evidência e histórico

- Coleta inicial: 9.833 URLs.
- Primeiro lote: 9.000 tentativas em 358 s.
- Coleta ampliada: 29.003 URLs únicas.
- Segundo lote: 20.003 tentativas em 934 s.
- Tranco `947L2`: 500.000 domínios processados, 499.985 URLs novas.
- Total coletado antes da Open Page Rank: **534.203 URLs únicas**.
- Open Page Rank processou 880.000 domínios antes da parada; total final do acervo: **1.189.191 URLs únicas**.
- Snapshot em 28/11/2026 02:31 UTC: **116.503 sites testados**, **1.072.688 na fila**, **41.092 erros de rede** e **75.411 respostas HTTP classificadas**.
- Lote de 500.000 testes iniciado com 128 workers e timeout de 6 s.
- Novo lote de 5.000 por vez, 96 workers e limite de 2 por origem foi encerrado pelo timeout do harness após **159.500 novas tentativas** e **13.425,5 s**. Não houve nova coleta.
- Último snapshot emitido: **273.503 tentativas**, **178.316 respostas HTTP classificadas**, **95.187 erros de rede** e **915.688 URLs na fila**. Progresso de **3,04%**; a meta de 9.000.000 não foi atingida.
- Classes nesse snapshot: 57.171 sem sinal; 37.469 login; 31.219 bloqueados; 17.542 loja/atendimento; 14.336 paywall; 8.825 geradores sem login; 6.288 chats sem login; 5.096 indisponíveis; 370 rate-limit.
- Último total concluído antes desse lote: **29.003 tentativas**, sendo **24.749 respostas HTTP classificadas** e **4.254 erros de rede**.
- O lote antigo foi interrompido após **76.500 novas tentativas**; total acumulado documentado: **105.503 tentativas**.
- Novo teste em lotes de 5.000 iniciado com 96 workers globais e limite de 2 por origem.
- Classes: 9.490 sem sinal; 5.750 loja/atendimento; 2.821 paywall; 2.562 bloqueados; 1.481 chats sem login; 1.359 login; 769 geradores; 517 indisponíveis.

> Esses números são o registro anterior à correção da classificação e das proteções SSRF. O lote em andamento não foi revalidado nesta alteração; as classes históricas não devem ser comparadas diretamente com resultados novos.

## Comandos

```powershell
python scripts/varredura-web.py --collect --max-repos 600 --meta 9000000
python scripts/varredura-web.py --tranco --tranco-limit 500000 --meta 9000000
python scripts/varredura-web.py --openpagerank --openpagerank-limit 9000000 --meta 9000000
python scripts/varredura-web.py --commoncrawl --cc-tlds com,net,org --cc-pages 100 --cc-page-size 100 --meta 9000000
python scripts/varredura-web.py --test --limit 20000 --batch-size 5000 --workers 96 --per-origin 2 --timeout 8 --meta 9000000
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
- **Progresso verificável:** `tentativas` soma a coluna `tentativas` (inclui reexecuções); `sites_testados` conta URLs únicas em estado `testado` ou `erro`. A meta de sites usa `sites_testados`; estar na fila não conta como concluído.
- **Concorrência por origem:** `--per-origin` limita requisições simultâneas ao mesmo host (padrão 2), além do teto global de `--workers`.
- **Retomada:** `--limit`, `--batch-size`, `--tranco-limit`, `--cc-pages` e `--cc-page-size` continuam limitando cada rodada. O teste processa a fila em lotes internos (padrão 5.000), evitando criar milhões de futures na memória. O SQLite com WAL preserva fila e resultados; a meta não elimina esses limites nem simula um lote.

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
- O limite por origem usa o host da URL da fila; um redirect validado pode mudar o destino, e a concorrência nesse segundo host não tem semáforo próprio.
