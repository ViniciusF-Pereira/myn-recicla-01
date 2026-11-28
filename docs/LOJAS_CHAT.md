# Teste de chats e buscas em lojas

Data: 27–28/11/2026. Teste somente leitura, sem cookies, credenciais ou envio para atendimento humano.

## Achados

| Loja | Resultado observado | Próximo passo do mapeador |
|---|---|---|
| Americanas | Home abriu. Há link “central de atendimento”; nenhum widget de chat foi identificado no HTML inicial. | Mapear a central de atendimento ou usar “ABA ATUAL”. |
| Magazine Luiza | A página retornou 403/Não é possível acessar. Há link “Falar com o Magalu”. | Não contornar; testar pelo navegador real após liberação do site. |
| Casas Bahia | Home abriu. Botão “CENTRAL DE ATENDIMENTO · Iniciar atendimento online” visível. | Abrir o widget, mapear campo/envio e pedir confirmação antes de enviar. |
| Lojas Renner | Home abriu. Links de atendimento e WhatsApp; não foi identificado chatbot de IA no HTML inicial. | Tratar como atendimento, não como rota de IA. |

## Mapeador implementado

- Descobre campo/formulário/botão de busca.
- Descobre cards, links, títulos e preços.
- Interpreta pedido, orçamento e ocasião.
- Filtra resultados visíveis, relevantes para o pedido e dentro do orçamento.
- Descobre entrada de chat e mapeia campo/envio/resposta únicos e semânticos.
- Envio no chat exige `confirmar: true`; negações como “não confirmo” são rejeitadas.
- O clique duplicado é bloqueado e o cancelamento interrompe a operação antes do envio.
- O sucesso só é anunciado depois de uma resposta nova e diferente do estado anterior.
- Registra até 200 eventos locais por 7 dias, sem prompt, resposta ou parâmetros de URL.

## Limites

- Não envia dados pessoais.
- Não contorna login, CAPTCHA, paywall ou rate limit.
- Chat de loja pode abrir atendimento humano; por isso o envio é sempre confirmado.
- Layouts mobile e widgets cross-origin podem exigir revisão manual.
- O aceite local de 27–28/11/2026 passou **25/25**, incluindo bloqueio de envio sem confirmação e resposta nova no chat-fixture.
