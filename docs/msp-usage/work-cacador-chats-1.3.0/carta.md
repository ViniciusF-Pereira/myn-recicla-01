# Carta crítica — WORK caçador de chats 1.3.0

## Pedido e escopo

O operador pediu uma versão confiável da extensão, API comercial utilizável, memória/RAG local, descoberta de chats/geradores/lojas, vídeo de demonstração e uma varredura web retomável. Esta rodada consolida a 1.3.0, aplica o redesign comercial da home e corrige os riscos encontrados na revisão de lojas/chat e da varredura.

Não houve crawling irrestrito sem fonte pública, contorno de CAPTCHA/login/paywall, segredo no Git ou permissão `<all_urls>`.

## Fatos verificados

- Catálogo da extensão: **32 chats**.
- Catálogo público do servidor: **190 plugins**, zero Google/Gemini nos campos de identidade do provedor.
- Suíte Node: **82/82**.
- Aceite isolado Microsoft Edge 158.0.4370.45: **25/25**, sem erros de manifesto ou runtime.
- Testes offline da varredura: **19/19**.
- Vídeo: `npm run check` aprovado; 90/90 contraste; 44 snapshots revisados; preview aberto, render não executado.
- Home: desktop 1440×1000 e mobile 390×844, sem overflow, sem imagens quebradas e sem falhas de rede após self-hosting das fontes.
- Meta de **9.000.000 tentativas** configurada; fonte Open Page Rank de 10 milhões integrada e coleta iniciada em segundo plano. Nenhuma conclusão da meta foi afirmada.

## Defeitos encontrados e corrigidos

- `signal` indefinido e assinatura errada da ponte em ferramentas de loja.
- Referência de loja comparada sem normalizar origem; fallback podia escolher a loja errada.
- Regex de confirmação aceitava frases de negação.
- Seletores genéricos de chat podiam atingir busca, menu ou botão errado.
- Sucesso do chat era anunciado sem resposta nova; agora o estado anterior é comparado.
- Cancelamento não interrompia o envio; clique duplo podia duplicar mensagens.
- Eventos de loja retinham URL completa, prompt e resposta; agora expõem apenas metadados e hashes, com expiração de 7 dias.
- Parser monetário convertia `199.90` em 19990; categoria confundia telefone com fone.
- Varredura classificava corpo antes do status, inflava inserções e aceitava hosts internos.
- Funções injetadas na página referenciavam helpers do módulo; foram tornadas autocontidas.

## Hipóteses e limites

- A lista Open Page Rank é uma fonte de descoberta, não prova de que cada domínio contém chat ou gerador.
- O teste HTTP é triagem; não prova geração, login livre nem disponibilidade futura.
- O crawler respeita DNS público e redirecionamentos, mas rebinding/proxy local continuam sendo limite documentado.
- Chats reais podem exigir sessão humana, CAPTCHA ou atendimento; nenhuma mensagem real foi enviada para uma loja externa.
- O vídeo está em preview e aguarda aprovação antes do MP4.

## Útil e aceito

- Extensão com adaptadores versionados, saúde, diagnóstico, modo manual e descoberta revisável.
- Mapeador de lojas com busca, orçamento, ocasião, produtos e chat confirmado.
- Home com promessa única, UI real, provas e CTAs acima da dobra.
- Vídeo com número gigante, código revelado, iris na imagem, playhead na voz e CTA final com hold.
- Coletor retomável com Open Page Rank, cache, provenance, SSRF e classificação corrigida.

## Descartado

- Envio automático para atendimento humano.
- Confirmação por regex que aceita negação.
- Anúncio de sucesso sem mudança real no DOM.
- Métricas de varredura inventadas ou URL na fila contada como teste concluído.
- Fonte de catálogo quebrada silenciosamente.

## Crítica destrutiva

“Abrir o navegador” não autoriza contornar barreiras. “Encontrar na internet” não é o mesmo que automatizar com segurança. “Começar a varredura” não é o mesmo que concluir 9 milhões de testes. A entrega só é honesta quando distingue fila, tentativa, resposta HTTP e validação humana.

## Prioridades

1. Concluir a coleta Open Page Rank e preservar o banco retomável.
2. Continuar os testes em lotes limitados, sem sobrecarregar provedores.
3. Aprovar o preview do vídeo e então renderizar.
4. Publicar a tag/release 1.3.0 com ZIP e evidências.
5. Revalidar catálogo e adaptadores periodicamente.

## Aceites

- `node --test`: 82/82.
- Edge isolado: 25/25.
- Python offline: 19/19.
- Vídeo: check aprovado e snapshots revisados.
- Home: QA desktop/mobile sem overflow ou falha de rede.

Recibo sanitizado: `receipts/validacao-local.md`.
