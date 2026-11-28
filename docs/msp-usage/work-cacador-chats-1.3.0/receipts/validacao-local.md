# Recibo sanitizado — WORK caçador de chats 1.3.0

Data: 2026-11-28 (UTC).

## Escopo

- Projeto: `myn-Recicla-01`.
- Tarefa: consolidação 1.3.0, extensão/lojas, catálogo público, home comercial, vídeo e varredura retomável.
- Chamadas MSP: nenhuma. Houve revisão por subagente local, sem provedor externo adicional.
- Segredos, tokens, cookies e conteúdo de conversas: não incluídos.

## Comandos e resultados

- `node scripts/empacotar-extensao.mjs`: ZIP gerado.
- `node --test`: 85 testes, 85 aprovados, 0 falhas.
- `node scripts/testar-extensao.mjs`: Edge 158.0.4370.45, extensão 1.3.0, 25/25 aceites.
- Envio de chat sem confirmação: `ok=false`, `codigo=confirmacao_necessaria`.
- Chat da loja: resposta nova `Loja: recebi seu pedido...`.
- `GET /api/plugins`: 190 itens públicos, zero Google/Gemini por id/nome/url/conta.
- `python -m unittest discover -s tests -p "test_varredura_web.py" -v`: 24/24.
- `python -m py_compile scripts/varredura-web.py tests/test_varredura_web.py`: sem erros.
- QA da home: 1440×1000 e 390×844; overflow=false; imagens quebradas=0; falhas de rede=0; cabeçalho sticky.
- QA de falha: com `/api/plugins` abortado, a prova mostra `—` e `plugins · dados indisponíveis`, sem inventar zero.
- Planilha Wi-Fi: CSV local com 9 colunas e 2 linhas de exemplo; zero requisições ao gateway ou provedor externo.
- Vídeo: `npm run check` aprovado; runtime/layout/motion/craft/audio sem erros; contraste 90/90.
- Vídeo: 44 snapshots de revisão e 3 frames adicionais do final inspecionados.

## Artefatos

- ZIP: `site/extensao/myn-recicla-extensao.zip`
- SHA256: `BFD3E02E0AC014E7FABAC6F72D97D36C70A9FC113F6D7812421A8721B4E561DE`
- Relatório de aceite: `outputs/extensao-teste.json`
- SHA256: `77019167C4CEB7E793E7F4EFDDE55761AFE588DCE60410E8B9554410B62E4E7F`
- Revisão do vídeo: `video/myn-api-demo/REVIEW.md`
- SHA256: `DB4B421CAF21D9360F676C547CB3CE13474148A9C8720086ECB768CD654C8B9D`
- Preview: `http://localhost:3002/#project/myn-api-demo?v=1&t=25.925&tab=design&rc=0`

## Limites

- A coleta foi parada com 1.189.191 URLs; o snapshot tinha 116.503 sites testados e 1.072.688 na fila. Coleta não é teste concluído.
- O vídeo não foi renderizado nem publicado.
- Nenhuma loja externa recebeu mensagem real.
- O Common Crawl pode limitar consultas; o banco permite retomar.
- A validação DNS não elimina rebinding/proxy local.
