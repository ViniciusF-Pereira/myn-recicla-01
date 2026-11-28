# SPEC — Myn API Demo

GOAL:    O espectador entende que o Myn é um agente/vendedor que conhece o produto e transforma uma chamada de API em texto, imagem e voz reais.
OUTPUT:  HyperFrames, 1920×1080, 30 fps.
TIME:    36 s × 30 = 1080 frames. Trilha a 100 BPM: 18 frames por batida.
LOOK:    Ground `#f3eddf` com 2% de granulação; ink `#14212b`; azul `#1f6fe0` como único acento de foco; amarelo `#e6a52e` apenas na prova/CTA. UI real capturada do Myn. Newsreader display 500/600, IBM Plex Sans body 400/600, IBM Plex Mono 500/600. Sombra dura offset 8×8, blur 0, opacidade 18%. Sem glass, glow ou partículas.
OBJECTS: favicon.svg real; painel real `/api.html`; request/response real `POST /v1/agent`; ilustração local registrada na provenance, sem rede; áudio real gerado por `/api/midia`; WORK como mascote/agente usando o símbolo real.
MOTION:  entrada power3.out 12–18f; câmera power2.inOut 18f; cortes com causa 6–12f; stagger 4f; sem loops infinitos. Motion blur render-time shutter 180. Uma mudança visual a cada 2–4 s.
SHOTS:
  000–120  Número 32 gigante, 190 plugins e zero chaves; provedores entram em stagger; voz: “Trinta e dois chats mapeáveis. E um agente que sabe o caminho.”
  120–300  WORK vendedor + UI real; entrada por pincel amarelo, selo 190 e linha de rota; voz: “Eu sou o WORK. Conheço as rotas, os limites e o caminho até o resultado.”
  300–480  Request real `POST /v1/agent` com `Explique o Myn em uma frase.`, chave mascarada, resposta HTTP 200; código revelado linha a linha; voz: “Uma chamada à API já conversa, lembra do contexto e escolhe a rota.”
  480–630  Texto real da resposta aparece; aspas, carimbo e marca-texta; voz: “Você pede uma resposta. Recebe texto pronto para usar.”
  630–780  Imagem real gerada pelo Myn em close; revelação iris preservando os pixels; voz: “Pede uma imagem. Ela é gerada sem chave.”
  780–930  Forma de onda + áudio real; playhead percorre os 3,8 s; voz: “Pede voz. O mesmo agente entrega a narração.”
  930–1080 Logo/wordmark reais, claim, URL e CTA com hold ≥ 2 s; voz: “Myn Recicla. Sua aba vira agente.”
BANNED:  dashboard inventado, métricas falsas, captcha/paywall, logo redesenha, produto em 3D, tela pequena no vazio, glow, três cards, lista de features, texto repetindo a narração palavra por palavra. A estética papel/serif/mono é exceção apenas porque já pertence à marca.
QA:      frames 30, 150, 300, 480, 660, 840, 990 e 1070; verificar UI real legível, chave mascarada, contraste, sincronia da voz e CTA final.
