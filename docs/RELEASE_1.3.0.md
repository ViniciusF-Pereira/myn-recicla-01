# Myn Recicla/01 — 1.3.0

## Destaques

- Home comercial com hero “Sua aba vira agente.”, UI real, provas, CTAs e movimento editorial.
- Extensão com **32 chats**, catálogo público com **190 plugins** e zero Google/Gemini.
- Mapeador de lojas com busca, produtos, orçamento, ocasião e chat confirmado.
- Envio de chat bloqueado sem confirmação explícita; negação, cancelamento e cliques duplicados tratados.
- Eventos de loja reduzidos a metadados/hashes, com expiração de 7 dias.
- Varredura retomável com GitHub, Tranco, Open Page Rank (10 milhões) e Common Crawl.
- Proteções SSRF, classificação por status e contagem correta de inserções.
- Meta configurada para **9.000.000 tentativas reais**; progresso não é simulado.
- Vídeo HyperFrames reforçado com número gigante, código revelado, iris, playhead e CTA final.
- Fontes da home self-hospedadas; sem requested Google Fonts.

## Evidência

- `node --test`: **82/82**.
- Edge isolado: **25/25**.
- Python offline: **19/19**.
- `GET /api/plugins`: **190**, zero Google/Gemini por identidade.
- Vídeo: check aprovado, 90/90 contraste, 44 snapshots revisados.
- Home: desktop e mobile sem overflow, imagens quebradas ou falhas de rede.

## Limites

- A varredura de 9 milhões está em andamento.
- O vídeo está em preview; o MP4 ainda não foi renderizado.
- Chats de lojas reais podem exigir login, CAPTCHA ou atendimento humano.
- Nenhuma mensagem real foi enviada para uma loja externa.

## Instalação

Baixe `myn-recicla-extensao.zip`, descompacte e carregue a pasta em `chrome://extensions` com o modo desenvolvedor ativado. Guia: `docs/EXTENSAO.md`.
