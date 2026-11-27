/** Descoberta local de adaptadores. Lê o DOM; não envia mensagens nem acessa rede. */
export function mapearPagina() {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects?.().length));
  const texto = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const atributo = (el, nome) => String(el.getAttribute?.(nome) || '');
  const escAttr = (v) => String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const escId = (v) => window.CSS?.escape ? window.CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const classesUteis = (el) => [...el.classList].filter((c) => c.length < 60 && !/^\d|^[_a-z0-9]{32,}$/i.test(c)).slice(0, 2);
  const seletorUnico = (el) => {
    const aceitar = (s) => { try { return document.querySelector(s) === el; } catch { return false; } };
    const id = el.id;
    if (id && aceitar('#' + escId(id))) return '#' + escId(id);
    const testid = atributo(el, 'data-testid');
    if (testid && aceitar('[data-testid="' + escAttr(testid) + '"]')) return '[data-testid="' + escAttr(testid) + '"]';
    const nome = atributo(el, 'name');
    if (nome && aceitar(el.tagName.toLowerCase() + '[name="' + escAttr(nome) + '"]')) return el.tagName.toLowerCase() + '[name="' + escAttr(nome) + '"]';
    const aria = atributo(el, 'aria-label');
    if (aria && aceitar(el.tagName.toLowerCase() + '[aria-label="' + escAttr(aria) + '"]')) return el.tagName.toLowerCase() + '[aria-label="' + escAttr(aria) + '"]';
    const role = atributo(el, 'role');
    if (role && aceitar(el.tagName.toLowerCase() + '[role="' + escAttr(role) + '"]')) return el.tagName.toLowerCase() + '[role="' + escAttr(role) + '"]';
    const classes = classesUteis(el);
    if (classes.length) {
      const s = el.tagName.toLowerCase() + classes.map((c) => '.' + escId(c)).join('');
      try { if (document.querySelectorAll(s).length === 1) return s; } catch { /* tenta o caminho */ }
    }
    if (el.tagName === 'TEXTAREA' && aceitar('textarea')) return 'textarea';
    if (el.isContentEditable && aceitar('[contenteditable="true"]')) return '[contenteditable="true"]';
    const partes = [];
    let atual = el;
    while (atual && atual !== document.body && partes.length < 5) {
      let parte = atual.tagName.toLowerCase();
      const classesPath = classesUteis(atual);
      if (classesPath.length) parte += classesPath.map((c) => '.' + escId(c)).join('');
      else if (atual.parentElement) {
        const irmaos = [...atual.parentElement.children].filter((n) => n.tagName === atual.tagName);
        parte += ':nth-of-type(' + (irmaos.indexOf(atual) + 1) + ')';
      }
      partes.unshift(parte); atual = atual.parentElement;
    }
    return partes.join(' > ') || el.tagName.toLowerCase();
  };
  const distancia = (a, b) => {
    if (!a || !b) return Infinity;
    const x = a.getBoundingClientRect(), y = b.getBoundingClientRect();
    return Math.hypot(x.left - y.left, x.top - y.top);
  };
  const mesmoForm = (a, b) => Boolean(a?.form && b?.form && a.form === b.form);
  const palavras = (v, regex) => regex.test(String(v || ''));
  const bodyText = texto(document.body).slice(0, 50000);
  const url = location.href;
  const bloqueio = /captcha|cloudflare turnstile|verify you are human/i.test(bodyText) ? 'captcha'
    : /paywall|subscribe to continue|upgrade to continue/i.test(bodyText) ? 'paywall' : '';

  const todos = [...document.querySelectorAll('*')].filter(visivel).slice(0, 6000);
  const compositores = todos.filter((el) => {
    if (el.matches('input[type="password"], input[type="hidden"]')) return false;
    return el.matches('textarea, input[type="text"], input[type="search"], [contenteditable="true"], [role="textbox"]');
  }).map((el) => {
    const alvo = (atributo(el, 'placeholder') + ' ' + atributo(el, 'aria-label') + ' ' + el.tagName).toLowerCase();
    let pontos = el.tagName === 'TEXTAREA' ? .55 : el.isContentEditable ? .5 : .4;
    if (palavras(alvo, /message|prompt|ask|chat|respond|reply|search|mensagem|pergunta|escreva|digite/)) pontos += .28;
    const r = el.getBoundingClientRect();
    if (r.width > 180 && r.height > 24) pontos += .12;
    if (r.top > innerHeight * .35) pontos += .06;
    if (el.form) pontos += .04;
    return { seletor: seletorUnico(el), pontos: Math.min(.99, pontos), evidencia: { tag: el.tagName.toLowerCase(), id: el.id, placeholder: atributo(el, 'placeholder'), ariaLabel: atributo(el, 'aria-label') } };
  }).sort((a, b) => b.pontos - a.pontos).slice(0, 5);

  let composerEl = null;
  try { if (compositores.length) composerEl = document.querySelector(compositores[0].seletor); } catch { /* candidato inválido não derruba o mapa */ }
  const envios = todos.filter((el) => el.matches('button, input[type="submit"], [role="button"]')).map((el) => {
    const alvo = (texto(el) + ' ' + atributo(el, 'aria-label') + ' ' + atributo(el, 'title') + ' ' + atributo(el, 'data-testid')).toLowerCase();
    let pontos = el.tagName === 'BUTTON' ? .4 : .35;
    if (palavras(alvo, /send|reply|respond|ask|enviar|responder|perguntar/)) pontos += .32;
    if (palavras(alvo, /delete|remove|destroy|excluir|apagar|limpar|clear|cancel|close|fechar|voltar|back|next|anterior/)) pontos -= .5;
    if (mesmoForm(el, composerEl)) pontos += .16;
    else if (distancia(el, composerEl) < 320) pontos += .12;
    if (!el.disabled) pontos += .08;
    return { seletor: seletorUnico(el), pontos: Math.min(.99, pontos), evidencia: { tag: el.tagName.toLowerCase(), id: el.id, texto: texto(el).slice(0, 100), ariaLabel: atributo(el, 'aria-label') } };
  }).sort((a, b) => b.pontos - a.pontos).slice(0, 5);

  const seletorUsuario = '[data-message-author-role="user"], [data-role="user" i], [class~="user"], [class*="user-message" i], [class*="human" i]';
  const seletorAssistente = '[data-message-author-role="assistant"], [data-testid="assistant-message"], .font-claude-response, [data-role="assistant" i], [class~="assistant"], [class*="assistant-message" i], [class*="answer" i]';
  const respostas = todos.filter((el) => {
    if (el.matches('html, body, main, script, style, noscript, svg, canvas, nav, footer, header, button, input, textarea, select')) return false;
    if (el.closest('nav, footer, header, button, input, textarea, select')) return false;
    if (el.matches(seletorUsuario) || el.closest(seletorUsuario) || el.querySelector(seletorUsuario)) return false;
    if (el.querySelectorAll(seletorAssistente).length > 1) return false;
    if (composerEl && el.contains(composerEl)) return false;
    const alvo = (el.id + ' ' + el.className + ' ' + atributo(el, 'role') + ' ' + atributo(el, 'data-testid') + ' ' + atributo(el, 'data-message-author-role')).toLowerCase();
    const t = texto(el);
    const semantico = palavras(alvo, /response|answer|assistant|prose|markdown|resposta|output|result/);
    if (!semantico || t.length > 20000) return false;
    return true;
  }).map((el) => {
    const alvo = (el.id + ' ' + el.className + ' ' + atributo(el, 'role') + ' ' + atributo(el, 'data-testid') + ' ' + atributo(el, 'data-message-author-role')).toLowerCase();
    const t = texto(el);
    let pontos = .2;
    if (palavras(alvo, /message|response|answer|assistant|chat|prose|markdown|resposta|mensagem/)) pontos += .38;
    if (el.matches('article, section, [role="article"], pre')) pontos += .14;
    if (el.querySelectorAll('p, pre, li').length) pontos += .1;
    if (t.length >= 40) pontos += .08;
    if (el.children.length > 12 && t.length > 5000) pontos -= .2;
    if (el.querySelectorAll('[data-message-author-role="assistant"], [data-testid="assistant-message"], .prose').length > 1) pontos -= .3;
    return { seletor: seletorUnico(el), pontos: Math.max(.05, Math.min(.99, pontos)), evidencia: { tag: el.tagName.toLowerCase(), id: el.id, classes: classesUteis(el) } };
  }).sort((a, b) => b.pontos - a.pontos).slice(0, 5);

  const compositor = compositores[0] || null, envio = envios[0] || null, resposta = respostas[0] || null;
  const confianca = compositor && envio && resposta
    ? Math.round((compositor.pontos * .4 + envio.pontos * .3 + resposta.pontos * .3) * (bloqueio ? .25 : 1) * 100) / 100
    : 0;
  return {
    url, titulo: document.title, origem: location.origin, bloqueio,
    elementos: { compositores: compositores.length, envios: envios.length, respostas: respostas.length },
    candidatos: { compositores, envios, respostas },
    sugestao: {
      compositor: compositor?.seletor || null,
      envio: envio?.seletor || null,
      resposta: resposta?.seletor || null,
      confianca,
    },
  };
}

function hashOrigem(origem) {
  let h = 2166136261;
  for (const c of String(origem)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export function criarAdaptador(relatorio, nome = '', escolhas = {}) {
  const s = relatorio?.sugestao;
  if (!s?.compositor || !s?.envio || !s?.resposta) throw new Error('a descoberta não encontrou composer, envio e resposta');
  if (relatorio.bloqueio) throw new Error('página bloqueada por ' + relatorio.bloqueio + '; nenhum adaptador foi ativado');
  const escolher = (lista, valor, padrao) => {
    const alvo = valor || padrao;
    const candidato = lista?.find((c) => c.seletor === alvo);
    if (!candidato) throw new Error('seletor escolhido não pertence aos candidatos desta descoberta');
    return candidato;
  };
  const compositor = escolher(relatorio.candidatos?.compositores, escolhas.compositor, s.compositor);
  const envio = escolher(relatorio.candidatos?.envios, escolhas.envio, s.envio);
  const resposta = escolher(relatorio.candidatos?.respostas, escolhas.resposta, s.resposta);
  const confianca = Math.round((compositor.pontos * .4 + envio.pontos * .3 + resposta.pontos * .3) * 100) / 100;
  if (!Number.isFinite(confianca) || confianca < .55) throw new Error('confiança insuficiente (' + Math.round(confianca * 100) + '%); revise os candidatos antes de ativar');
  const urlOperacional = relatorio.urlOperacional || relatorio.url;
  const assinatura = [relatorio.origem, urlOperacional, compositor.seletor, envio.seletor, resposta.seletor].join('|');
  return {
    id: 'descoberto-' + hashOrigem(assinatura),
    nome: nome || relatorio.titulo || relatorio.origem,
    url: urlOperacional,
    origem: relatorio.origem,
    versao: 1,
    campos: [compositor.seletor],
    envio: [envio.seletor],
    respostas: [resposta.seletor],
    login: [],
    descoberta: true,
    confianca,
  };
}
