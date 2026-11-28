# Mídia browser-only

A mídia padrão do Myn roda no navegador. Nenhum binário local é necessário para o caminho web.

## Implementação

- **Imagem:** Pollinations por `fetch`; fallback visual em Canvas; estilos editorial, minimalista, vibrante, retrô e fotorrealista.
- **Voz:** `SpeechSynthesis`.
- **Gravação de voz:** `getDisplayMedia` + `MediaRecorder` + SpeechSynthesis, com permissão do usuário.
- **Vídeo/animação:** Canvas + `captureStream` + `MediaRecorder` (WebM), com temas, movimento, duração e barra de progresso.
- **OCR:** Tesseract.js via CDN.
- **PDF:** pdf.js via CDN.
- **Texto:** File API.

## Onde é usado

- Estúdio de mídia do Playground (prompt, estilo, formato, duração, preview, download e histórico);
- botões de mídia do Playground;
- anexos do Playground;
- comandos de mídia do WORK.

## Limites honestos

- O navegador não produz GIF nativo por MediaRecorder; a animação é WebM.
- SpeechSynthesis varia conforme o navegador e as vozes instaladas.
- Gravar a voz exige permissão de compartilhamento de áudio.
- Tesseract.js/pdf.js são bibliotecas web carregadas de CDN.
- Pollinations é um serviço web externo e pode ter cota.

## Legado

Os endpoints locais `/api/midia` e `/api/documento` permanecem como compatibilidade para integrações antigas, mas não são o caminho padrão da interface. A imagem Docker browser-only não instala Python, PIL, ffmpeg, edge-tts ou Tesseract.
