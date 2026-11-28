# Carta crítica — WORK caçador de chats 1.3.1

## Pedido e escopo

O operador pediu uma revisão de design e usabilidade no Playground e na extensão, além de streaming SSE, orientação de tools, widgets de pesquisa, Estúdio de Mídia e um objetivo de comparação objetiva com um chat genérico.

A entrega mantém browser-only, sem chaves pagas, sem Google/Gemini e sem contorno de login/CAPTCHA/paywall.

## Fatos verificados

- Playground redesenhado com composer limpo, ferramentas avançadas recolhidas e hierarquia de mensagens.
- Estúdio de mídia com prompt, estilo, formato, duração, preview, download e histórico.
- Extensão 1.3.1 com logo real, abas Rotas/Chats/Lojas e diagnósticos recolhidos.
- SSE com eventos semânticos de criação, progresso de tool, delta de texto e conclusão.
- Widgets de intenção, ferramentas, fontes e progresso.
- Cancelamento e reconexão de stream validados no navegador; rota explícita não é repetida.
- Roteador determinístico com 6/6 casos de intenção.
- Benchmark local: três rodadas por caso; mediana do primeiro token 21 ms para identidade e 13 ms para pesquisa, nesta máquina.
- Suíte Node: 89/89; Python offline: 24/24; aceite isolado da extensão: 25/25.

## Falhas encontradas e corrigidas

- A primeira execução do aceite terminou em 9/25 porque a ponte ainda não tinha sido detectada quando o teste seguiu para as rotas. O diagnóstico isolado confirmou a ponte funcionando; o teste agora aguarda a disponibilidade e lista cada critério. A execução seguinte passou 25/25.
- O QA do Playground mostrou “pesquise sobre a extensão” indo para catálogo. A causa era um regex que exigia a palavra exata “pesquis”. O radical foi corrigido e ganhou teste de regressão.
- Uma execução instrumentada do aceite ficou presa durante os prints. O CDP agora tem timeout por chamada, logs por etapa, recarga separada e prints não bloqueantes; nenhum critério funcional foi removido.

## Hipóteses e limites

- O benchmark não é comparação direta paga com o ChatGPT; é baseline verificável do Myn.
- Pesquisa web em tempo real ainda depende de rota externa.
- Vídeo browser-only é animação Canvas/MediaRecorder.
- Layouts externos e widgets cross-origin continuam sujeitos a revisão manual.

## Útil e aceito

- Ferramentas locais antes do modelo evitam gateway desnecessário.
- O usuário vê qual tool está sendo executada e quais fontes sustentam a resposta.
- Artefatos têm preview e download.
- O painel estreito ficou mais legível e menos denso.

## Descartado

- Prometer paridade sem medição direta.
- Inventar fontes, métricas ou telas.
- Enviar mensagens externas sem confirmação.
- Tratar pesquisa HTTP como prova de automação completa.

## Crítica destrutiva

“Melhor que o ChatGPT” não é uma frase de marketing válida sem benchmark cego, mesmas tarefas e medição de latência, acerto, artefatos e custo. O objetivo agora é transformar essa comparação em teste reproduzível.

## Prioridades

1. Pesquisa web externa com fontes citadas.
2. Projetos locais com arquivos e instruções.
3. Mais tools executáveis dentro do SSE.
4. Benchmark cego em 20 tarefas.
5. Render do vídeo após aprovação do preview.

## Aceites

- `node --test`: 89/89.
- Edge isolado: 25/25.
- Python offline: 24/24.
- Playground desktop/mobile sem overflow.
- SSE, widgets, cancelamento e reconexão validados.

Recibo sanitizado: `receipts/validacao-local.md`.
