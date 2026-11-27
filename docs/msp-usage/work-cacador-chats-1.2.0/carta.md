# Carta crítica — WORK caçador de chats 1.2.0

## Pedido e escopo

O operador pediu que o WORK rastreasse páginas de chat, encontrasse novas formas de conexão e ampliasse a descoberta para novos sites. A entrega cobre catálogo curado, leitura local do DOM, sugestão de seletores, ativação revisada e integração com o assistente. Não cobre crawling irrestrito nem contorno de controles de acesso.

## Fatos

- O catálogo contém 23 chats, cada um com origem HTTPS e autorização opcional própria.
- O manifest não contém `<all_urls>`; usa origens opcionais e `activeTab`.
- O mapeamento não envia mensagens e a ativação apenas persiste um adaptador.
- A suíte Node passou 74/74.
- O aceite em Edge isolado passou 16/16, incluindo descoberta, ativação, execução da rota criada, deduplicação e sinalização de acesso temporário.
- O relatório final não registrou erros de manifesto ou runtime da extensão.
- Não houve chamada MSP/LLM externa nesta tarefa.

## Hipóteses e limites

- A semântica do DOM deve encontrar bons candidatos em chats comuns, mas layouts novos ainda podem exigir escolha manual.
- O catálogo é uma seleção verificada por alcance HTTP, não uma prova de automação nem uma lista exaustiva.
- `activeTab` depende de o usuário invocar a extensão com a aba ativa; acesso permanente exige origem declarada.
- Provedores externos continuam sujeitos a login, CAPTCHA, paywall, mudança de layout e cota.

## Útil e aceito

- Motor de descoberta separado, sem rede e sem ações durante o mapeamento.
- Painel com filtro, candidatos numerados, confiança e bloqueio detectado.
- Comandos locais do WORK para listar, mapear e ativar.
- Rotas descobertas aceitas no fallback somente após ativação explícita.
- Teste de aceite que prova o fluxo completo numa página inocente.

## Descartado

- Varredura automática de toda a internet sem allowlist.
- Permissão ampla efetiva, equivalente a `<all_urls>`.
- Ativação ou envio automático sem revisão.
- Qualquer tentativa de contornar CAPTCHA, login ou paywall.

## Crítica construtiva

A primeira implementação expôs dois defeitos reais: o ID da descoberta sobrescrevia o ID do envelope da ponte, e o comando `liste os chats` não correspondia ao regex. A revisão independente também identificou riscos de seletor ambíguo, resposta agregada, confiança recalculada incorretamente, concorrência e permissão temporária mal sinalizada. Todos foram corrigidos: seletores são revalidados no clique, respostas usam nós assistentes, a confiança usa os candidatos escolhidos, gravações são serializadas e `activeTab` aparece como temporário. Próximas melhorias: testar `activeTab` com origem arbitrária real e oferecer revalidação periódica do catálogo.

## Crítica destrutiva

A premissa “basta abrir um navegador para contornar” deve ser rejeitada. Navegador real amplia o que pode ser automatizado dentro da sessão autorizada, mas não transforma CAPTCHA, paywall ou autenticação em algo permitido. Outra abordagem a rejeitar é prometer `todos os chats`: sem critérios de descoberta e autorização, isso produz ruído, risco e falsos positivos.

## Soluções e prioridade

1. Manter catálogo curado e ampliável, com estado de verificação visível.
2. Usar `activeTab` para mapear aba atual sem acesso permanente.
3. Exigir revisão e confiança mínima antes de ativar.
4. Adicionar testes de regressão para IDs de mensagem e provedores novos.
5. Priorizar provedores que respondem sem login e têm DOM estável.

## Aceites

- `node --test`: 74/74.
- Edge isolado: 16/16.
- Descoberta local: 87% de confiança.
- Rota descoberta executada: `OK local: teste descoberto`.
- WORK listou o catálogo.
- Sem erros de manifesto/runtime no relatório final.

Recibo sanitizado: `receipts/validacao-local.md`.
