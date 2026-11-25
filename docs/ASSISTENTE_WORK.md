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
- ações rápidas (rotas, pesquisa, catálogo, sobre);
- histórico persistente das últimas 40 mensagens no navegador;
- navegação local pela página (`ir para catálogo`, `abrir playground`, etc.);
- renderização de imagem retornada pelas ferramentas de mídia.

## Ferramentas MCP usadas

- `myn_chat`
- `myn_pesquisar`
- `myn_rotas`
- `myn_plugin`
- `myn_imagem`
- `myn_audio`
- `myn_video`
- `myn_documento`
- `myn_historico`
- `myn_mensagem`

Google/Gemini não fazem parte do catálogo.

## Privacidade

- O som e a voz são processados no navegador.
- O texto do chat vai para as ferramentas MCP do próprio site.
- Ferramentas de chat podem acionar provedores free externos; isso é inerente à rota escolhida.
- O WORK não envia código-fonte para LLM no fluxo padrão dos workers.

## Validação executada

- `myn_rotas`: 154 plugins, saúde retornada.
- `myn_pesquisar`: documento `docs/WORKER_INFINITO.md`.
- `myn_chat`: identidade e resumo local.
- `myn_imagem`: JPEG gerado.
- `myn_audio`: MP3 gerado.
- `myn_video`: MP4 de 3 segundos gerado.
- `myn_documento`: TXT extraído com 20 caracteres.
- Cancelamento: chamada lenta interrompida e estado restaurado.
- Histórico: mensagens mantidas após recarregar a página.

## Atalhos

- `WORK.abrir()` / `WORK.fechar()`
- `WORK.enviar("texto")`
- `WORK.cancelar()`
- `WORK.ferramentas()`
