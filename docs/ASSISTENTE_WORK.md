# WORK — assistente virtual MCP

O WORK aparece flutuante na home, no Playground, no mapa de evidências e no painel único.

## Recursos

- mascote com olhos, piscadas, movimento de pupilas, flutuação e halo;
- som de chamada gerado por Web Audio API;
- apresentação automática na bolha e narrada no primeiro gesto/voz ativada;
- bolha clicável e mini-chat;
- respostas por voz com `SpeechSynthesis` do navegador;
- entrada por voz com `SpeechRecognition` quando disponível;
- integração real com `/mcp`;
- indicação da ferramenta MCP em uso durante a execução;
- botão para cancelar a chamada em andamento;
- ações rápidas (caçar chats, rotas, pesquisa, catálogo, sobre);
- histórico persistente das últimas 40 mensagens no navegador;
- navegação local pela página (`ir para catálogo`, `abrir playground`, etc.);
- renderização de imagem retornada pelas ferramentas de mídia.

## Ferramentas MCP usadas

- `myn_chat`
- `myn_pesquisar`
- `myn_rotas`
- `myn_planejar`
- `myn_loop`
- `myn_arquitetura`
- `myn_desempenho`
- `myn_modelos`
- `myn_plugin`
- `myn_imagem`
- `myn_audio`
- `myn_video`
- `myn_documento`
- `myn_historico`
- `myn_mensagem`

Google/Gemini não fazem parte do catálogo.

## Ferramentas locais de descoberta

- `chats_catalogo` — lista os 23 chats conhecidos;
- `extensao_descobrir` — mapeia um chat autorizado sem enviar mensagens;
- `extensao_descobrir_aba_atual` — mapeia a aba atual com `activeTab`;
- `extensao_ativar` — ativa o último adaptador descoberto após pedido explícito.

Comandos úteis: `liste os chats`, `mapear Perplexity`, `mapear esta aba` e `ativar adaptador descoberto`.

## Privacidade

- O som e a voz são processados no navegador.
- O texto do chat vai para as ferramentas MCP do próprio site.
- Ferramentas de chat podem acionar provedores free externos; isso é inerente à rota escolhida.
- O WORK não envia código-fonte para LLM no fluxo padrão dos workers.

## Validação executada

- `myn_rotas`: 154 plugins, saúde retornada.
- `myn_planejar`: plano gerado via Pollinations.
- `myn_arquitetura`: 64 módulos, 92 dependências, 0 violações.
- `myn_desempenho`: medição p50/bytes retornada.
- `myn_modelos`: 34 modelos descobertos.
- `myn_pesquisar`: documento `docs/WORKER_INFINITO.md`.
- `myn_chat`: identidade e resumo local.
- `myn_imagem`: JPEG gerado.
- `myn_audio`: MP3 gerado.
- `myn_video`: MP4 de 3 segundos gerado.
- `myn_documento`: TXT extraído com 20 caracteres e anexo enviado pelo mini-chat.
- Player de áudio: `<audio controls>` criado no chat.
- Cancelamento: chamada lenta interrompida e estado restaurado.
- Histórico: mensagens mantidas após recarregar a página.
- Três abas abertas: chamada MCP respondida em 9 ms, sem esgotar conexões (SSE combinado).
- `chats_catalogo`: 23 chats retornados no Edge isolado.
- Descoberta local: confiança 87%, adaptador ativado e rota executada.

## Atalhos

- `WORK.abrir()` / `WORK.fechar()`
- `WORK.enviar("texto")`
- `WORK.cancelar()`
- `WORK.ferramentas()`
