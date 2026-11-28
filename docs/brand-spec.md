# Myn Recicla/01 — Brand Spec

## Assets reais

- Símbolo/logo: `site/favicon.svg`
- Wordmark: tipografia inline `.logo` já usada em `site/index.html` e `site/playground.html`
- Hero/colagem: `site/assets/hero-sky.jpg`
- UI real: `docs/prints/extensao-descoberta.png`, `docs/prints/extensao-playground.png`, `docs/prints/memoria-rag.png`
- Fontes locais: `site/assets/fonts/newsreader-500.ttf`, `newsreader-500-italic.ttf`, `ibm-plex-sans-400.ttf`, `ibm-plex-sans-600.ttf` e `ibm-plex-mono.ttf` (sem requested Google Fonts)

## Direção

**Engenharia de colagem cinética.** Editorial impresso encontra painel de instrumentos. A interface deve parecer uma bancada de engenharia: papel, tinta, recortes, diagramas e controles precisos. A ousadia vem da composição e da escala, não de gradientes genéricos.

## Paleta

- Tinta: `#14212b`
- Papel: `#f3eddf`
- Azul: `#1f6fe0`
- Azul profundo: `#0d2a4a`
- Mostarda: `#e6a52e`
- Vermelho: `#e9654f`
- Verde-petróleo: `#0d8f87`
- Branco quente: `#fffdf7`

Coral e verde-petróleo são acentos de estado/contraste. Lilás e verde-lima saem do sistema principal.

## Tipografia

- Display: Newsreader, 500–600, itálico como acento
- Corpo: IBM Plex Sans, 400–600
- Metadados/controles: IBM Plex Mono, 500–600
- Corpo web: 16–17 px; títulos fluidos com `clamp()`

## Espaço e forma

- Base: 8 px
- Escala: 8, 12, 16, 24, 32, 48, 72, 96
- Raio: 2–6 px em superfícies operacionais; 999 px apenas em chips de estado
- Sombra: offset duro de papel/tinta; sem blur em cards operacionais
- Motion: 160–320 ms; uma assinatura de movimento por tela; `prefers-reduced-motion`

## Voz

- Direta, técnica e brasileira.
- Promessa concreta antes da metáfora.
- Sem fingir automação universal, sem números inventados e sem prometer contorno de acesso.

## Assinatura de conversão 1.3

- Hero: promessa “Sua aba vira agente.”, CTA duplo e UI real em janela recortada.
- Prova: 32 chats, 190 plugins, 25/25 aceites e zero chaves.
- Movimento: ticker de provedores, reveal por scroll, progresso de leitura e parallax discreto no desktop.
- Conversão: faixa amarela de chamada final e dock fixo no mobile.
- Acessibilidade: foco visível, `prefers-reduced-motion`, alvos de toque e sem overflow horizontal.

## Contratos protegidos

- Logo, wordmark e nome do produto.
- Rotas, IDs, APIs, permissões e chaves de armazenamento.
- Fluxos de chat, extensão, memória, RAG e API comercial.
- Ausência de Google/Gemini, serviços pagos e segredos no repositório.
