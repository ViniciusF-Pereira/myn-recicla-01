# Recibo sanitizado — WORK caçador de chats 1.3.0

Data: 2026-11-28 (UTC).

## Escopo

- Projeto: `myn-Recicla-01`.
- Tarefa: consolidação 1.3.0, extensão/lojas, catálogo público, home comercial, vídeo e varredura retomável.
- Chamadas MSP: nenhuma. Houve revisão por subagente local, sem provedor externo adicional.
- Segredos, tokens, cookies e conteúdo de conversas: não incluídos.

## Comandos e resultados

- `node scripts/empacotar-extensao.mjs`: ZIP gerado.
- `node --test`: 82 testes, 82 aprovados, 0 falhas.
- `node scripts/testar-extensao.mjs`: Edge 158.0.4370.45, extensão 1.3.0, 25/25 aceites.
- Envio de chat sem confirmação: `ok=false`, `codigo=confirmacao_necessaria`.
- Chat da loja: resposta nova `Loja: recebi seu pedido...`.
- `GET /api/plugins`: 190 itens públicos, zero Google/Gemini por id/nome/url/conta.
- `python -m unittest discover -s tests -p "test_varredura_web.py" -v`: 19/19.
- `python -m py_compile scripts/varredura-web.py tests/test_varredura_web.py`: sem erros.
- QA da home: 1440×1000 e 390×844; overflow=false; imagens quebradas=0; falhas de rede=0.
- Vídeo: `npm run check` aprovado; runtime/layout/motion/craft/audio sem erros; contraste 90/90.
- Vídeo: 44 snapshots de revisão e 3 frames adicionais do final inspecionados.

## Artefatos

- ZIP: `site/extensao/myn-recicla-extensao.zip`
- SHA256: `9E033B27C08C76AC6224FEEA23F2FC037038541F148BBE9618A808015AD03080`
- Relatório de aceite: `outputs/extensao-teste.json`
- SHA256: `5170F1360695C5145CAB56D2217E471AEC9516D1C612395178ADE7631D4D0451`
- Revisão do vídeo: `video/myn-api-demo/REVIEW.md`
- SHA256: `315AC0FF65F177135ADE84033449D17A149637E8D8EE012E009E32984B67467A`
- Preview: `http://localhost:3002/#project/myn-api-demo?v=1&t=25.925&tab=design&rc=0`

## Limites

- A meta de 9.000.000 ainda está em progresso; coleta não é teste concluído.
- O vídeo não foi renderizado nem publicado.
- Nenhuma loja externa recebeu mensagem real.
- O Common Crawl pode limitar consultas; o banco permite retomar.
- A validação DNS não elimina rebinding/proxy local.
