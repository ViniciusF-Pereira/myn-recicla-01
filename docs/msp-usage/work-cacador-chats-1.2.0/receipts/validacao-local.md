# Recibo sanitizado — WORK caçador de chats 1.2.0

Data: 2026-11-27 (UTC).

## Escopo

- Projeto: `Myn-Recicla-01`.
- Tarefa: catálogo de chats, descoberta de adaptadores por DOM, painel lateral e comandos locais do WORK.
- Chamadas MSP/LLM externas: nenhuma.
- Segredos, tokens, cookies e conteúdo de conversas: não incluídos.

## Comandos e resultados

- `node scripts/empacotar-extensao.mjs`: ZIP gerado.
- `node --test`: 74 testes, 74 aprovados, 0 falhas.
- `node scripts/testar-extensao.mjs`: Microsoft Edge 158.0.4370.45, extensão 1.2.0 habilitada, 13/13 aceites.
- Mapeamento local: confiança 0,87; seletores `#mensagem`, `#enviar` e `#resposta`.
- Adaptador descoberto: ativado e executado com resposta `OK local: teste descoberto`.
- WORK: comando `liste os chats` retornou catálogo contendo Perplexity e Qwen.
- Pollinations: resposta `OK` no navegador.
- Erros de manifesto/runtime da extensão: nenhum no relatório final.

## Artefatos

- ZIP: `site/extensao/myn-recicla-extensao.zip`
- SHA256: `ba9e3d97e6821529c3af8db57cfa204cdebff2ab43e7fcdf43729238a0dab66d`
- Relatório: `outputs/extensao-teste.json`
- SHA256: `4780577c883e166e68abe9dee55eaaa0a23a5dd1158e1c560ad2bf7bc2a385fc`

## Limites

- O catálogo é curado e não é uma varredura exaustiva da internet.
- Os sites externos podem mudar layout, exigir login ou impor cota.
- `activeTab` foi revisado no código, mas não recebeu um teste real de origem arbitrária neste aceite.
- Nenhum contorno de CAPTCHA, paywall ou autenticação foi implementado.
