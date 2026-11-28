/** Descoberta local de lojas: busca, produtos e entradas. Não envia dados para fora. */
export function parseValorMonetario(valor) {
  const bruto = String(valor || '').match(/-?\d[\d.,]*/)?.[0];
  if (!bruto) return null;
  const neg = bruto.startsWith('-');
  let texto = bruto.replace('-', '');
  const ultimaVirgula = texto.lastIndexOf(',');
  const ultimoPonto = texto.lastIndexOf('.');
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    texto = ultimaVirgula > ultimoPonto
      ? texto.replace(/\./g, '').replace(',', '.')
      : texto.replace(/,/g, '');
  } else if (ultimaVirgula >= 0) {
    const casas = texto.length - ultimaVirgula - 1;
    texto = texto.split(',').length === 2 && casas > 0 && casas <= 2 ? texto.replace(',', '.') : texto.replace(/,/g, '');
  } else if (ultimoPonto >= 0) {
    const casas = texto.length - ultimoPonto - 1;
    const antes = texto.slice(0, ultimoPonto);
    if (casas === 3 && antes.length <= 3) texto = texto.replace(/\./g, '');
  }
  const numero = Number(texto);
  return Number.isFinite(numero) ? (neg ? -numero : numero) : null;
}

export function normalizarTexto(valor) {
  return String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function produtoCorresponde(titulo, termo) {
  const paradas = new Set(['de', 'da', 'do', 'para', 'com', 'sem', 'um', 'uma', 'ate', 'reais', 'real']);
  const tokens = normalizarTexto(termo).split(/[^a-z0-9]+/).filter((t) => t && !paradas.has(t));
  if (!tokens.length) return true;
  const tituloNormal = normalizarTexto(titulo);
  const tokensTitulo = new Set(tituloNormal.split(/[^a-z0-9]+/).filter(Boolean));
  return tokens.every((t) => tokensTitulo.has(t));
}

function urlSemParametros(valor) {
  try { const u = new URL(valor); u.username = ''; u.password = ''; u.search = ''; u.hash = ''; return u.href; } catch { return ''; }
}

function seletorUnico(el) {
  if (!el) return null;
  const esc = (v) => window.CSS?.escape ? window.CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const classes = (n) => [...n.classList].filter((c) => c.length < 60 && !/^\d|^[_a-z0-9]{32,}$/i.test(c)).slice(0, 2);
  const teste = (s) => { try { return document.querySelector(s) === el; } catch { return false; } };
  if (el.id && teste('#' + esc(el.id))) return '#' + esc(el.id);
  const testid = el.getAttribute('data-testid');
  if (testid && teste('[data-testid="' + testid.replace(/"/g, '\\"') + '"]')) return '[data-testid="' + testid.replace(/"/g, '\\"') + '"]';
  const nome = el.getAttribute('name');
  if (nome && teste(el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]';
  const aria = el.getAttribute('aria-label');
  if (aria && teste(el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
  const cs = classes(el);
  if (cs.length) {
    const s = el.tagName.toLowerCase() + cs.map((c) => '.' + esc(c)).join('');
    try { if (document.querySelectorAll(s).length === 1) return s; } catch { /* caminho */ }
  }
  const partes = [];
  let atual = el;
  while (atual && atual !== document.body && partes.length < 5) {
    let p = atual.tagName.toLowerCase();
    const cp = classes(atual);
    if (cp.length) p += cp.map((c) => '.' + esc(c)).join('');
    else if (atual.parentElement) {
      const irmaos = [...atual.parentElement.children].filter((n) => n.tagName === atual.tagName);
      p += ':nth-of-type(' + (irmaos.indexOf(atual) + 1) + ')';
    }
    partes.unshift(p); atual = atual.parentElement;
  }
  return partes.join(' > ') || el.tagName.toLowerCase();
}

export function mapearPaginaLoja() {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects?.().length));
  const texto = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const attr = (el, n) => String(el.getAttribute?.(n) || '');
  const esc = (v) => window.CSS?.escape ? window.CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
  const classes = (el) => [...el.classList].filter((c) => c.length < 60 && !/^\d|^[_a-z0-9]{32,}$/i.test(c)).slice(0, 2);
  const unico = (el) => {
    const teste = (s) => { try { return document.querySelector(s) === el; } catch { return false; } };
    if (el.id && teste('#' + esc(el.id))) return '#' + esc(el.id);
    const testid = attr(el, 'data-testid');
    if (testid && teste('[data-testid="' + testid.replace(/"/g, '\\"') + '"]')) return '[data-testid="' + testid.replace(/"/g, '\\"') + '"]';
    const nome = attr(el, 'name');
    if (nome && teste(el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]';
    const aria = attr(el, 'aria-label');
    if (aria && teste(el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
    const cs = classes(el);
    if (cs.length) {
      const s = el.tagName.toLowerCase() + cs.map((c) => '.' + esc(c)).join('');
      try { if (document.querySelectorAll(s).length === 1) return s; } catch { /* caminho */ }
    }
    const partes = [];
    let atual = el;
    while (atual && atual !== document.body && partes.length < 5) {
      let p = atual.tagName.toLowerCase();
      const cp = classes(atual);
      if (cp.length) p += cp.map((c) => '.' + esc(c)).join('');
      else if (atual.parentElement) {
        const irmaos = [...atual.parentElement.children].filter((n) => n.tagName === atual.tagName);
        p += ':nth-of-type(' + (irmaos.indexOf(atual) + 1) + ')';
      }
      partes.unshift(p); atual = atual.parentElement;
    }
    return partes.join(' > ') || el.tagName.toLowerCase();
  };
  const lista = (el) => {
    const testid = attr(el, 'data-testid');
    if (testid) return '[data-testid="' + testid.replace(/"/g, '\\"') + '"]';
    const cs = classes(el);
    if (cs.length) return el.tagName.toLowerCase() + cs.map((c) => '.' + esc(c)).join('');
    return el.tagName.toLowerCase();
  };
  const preco = (t) => /(?:R\$|US\$|€|£)\s*\d|\d+[.,]\d{2}/.test(t);
  const linkProduto = (a) => /produto|product|\/p\/|\/item\/|\/dp\/|oferta|deal/i.test(a.href || '') && !/categoria|category|busca|search|login|conta/i.test(a.href || '');
  const todos = [...document.querySelectorAll('*')].filter(visivel).slice(0, 7000);

  const buscas = todos.filter((el) => el.matches('input[type="search"], input:not([type="password"]):not([type="hidden"]):not([type="email"]):not([type="tel"]):not([type="submit"]):not([type="button"]), [role="searchbox"]')).map((el) => {
    const alvo = (attr(el, 'type') + ' ' + attr(el, 'placeholder') + ' ' + attr(el, 'aria-label') + ' ' + attr(el, 'name')).toLowerCase();
    const semantico = el.type === 'search' || el.getAttribute('role') === 'searchbox' || /buscar|busca|pesquis|search|procurar|find/.test(alvo);
    if (!semantico) return null;
    const pontos = Math.min(.99, .6 + (/buscar|busca|pesquis|search|procurar|find/.test(alvo) ? .25 : 0) + (el.form ? .1 : 0));
    return { seletor: unico(el), pontos, formulario: el.form ? unico(el.form) : null };
  }).filter(Boolean).sort((a, b) => b.pontos - a.pontos);
  const busca = buscas[0] || null;
  const campoBusca = busca ? document.querySelector(busca.seletor) : null;
  const formBusca = campoBusca?.form || document.querySelector('[role="search"]');
  const botoesBusca = todos.filter((el) => el.matches('button, input[type="submit"], [role="button"]')).map((el) => {
    const alvo = (texto(el) + ' ' + attr(el, 'aria-label') + ' ' + attr(el, 'title') + ' ' + attr(el, 'type')).toLowerCase();
    const semantico = /buscar|busca|pesquis|search|procurar|find/.test(alvo);
    if (!semantico) return null;
    const mesmoForm = Boolean(formBusca && (el.form === formBusca || formBusca.contains(el)));
    const pontos = Math.min(.99, .6 + (mesmoForm ? .3 : 0));
    return { seletor: unico(el), pontos, valido: mesmoForm };
  }).filter((x) => x?.valido).sort((a, b) => b.pontos - a.pontos);
  const botaoBusca = botoesBusca[0] || null;

  const cards = todos.filter((el) => {
    if (el.matches('html, body, main, a, button, input, script, style, nav, footer, header')) return false;
    if (el.querySelectorAll('article, [data-testid*="product" i], [class*="product" i], [class*="produto" i]').length > 1) return false;
    const links = [...el.querySelectorAll('a[href]')].filter(linkProduto);
    const t = texto(el);
    return links.length > 0 && preco(t) && t.length < 4000;
  }).map((el) => {
    const links = [...el.querySelectorAll('a[href]')].filter(linkProduto);
    const tituloEl = el.querySelector('h2,h3,[data-testid*="name" i],[class*="title" i],[class*="nome" i]') || links[0];
    const precoEl = el.querySelector('[data-testid*="price" i],[class*="price" i],[class*="preco" i]') || null;
    let pontos = .35 + Math.min(.25, links.length * .08);
    if (tituloEl) pontos += .2;
    if (precoEl) pontos += .2;
    return {
      seletor: lista(el), pontos: Math.min(.99, pontos),
      link: links[0] ? unico(links[0]) : null,
      titulo: tituloEl ? unico(tituloEl) : null,
      preco: precoEl ? unico(precoEl) : null,
      exemplo: texto(el).slice(0, 180),
    };
  }).sort((a, b) => b.pontos - a.pontos);
  const card = cards[0] || null;
  const entradas = todos.filter((el) => el.matches('a[href], button')).filter((el) => linkProduto(el) || /comprar|ver produto|detalhes|add to cart|adicionar/i.test(texto(el) + ' ' + attr(el, 'aria-label'))).map((el) => ({ seletor: unico(el), texto: texto(el).slice(0, 100), href: el.href || '' })).slice(0, 8);
  const chatEntradas = todos.filter((el) => el.matches('button, a[href], [role="button"]')).filter((el) => /atendimento online|iniciar atendimento|fale conosco|chat online|assistente virtual|abrir chat/i.test(texto(el) + ' ' + attr(el, 'aria-label'))).map((el) => ({ seletor: unico(el), texto: texto(el).slice(0, 100) })).slice(0, 5);
  const confianca = Math.round(((busca?.pontos || 0) * .35 + (botaoBusca?.pontos || 0) * .15 + (card?.pontos || 0) * .5) * 100) / 100;
  const corpo = texto(document.body).slice(0, 50000);
  const bloqueio = /captcha|cloudflare turnstile|verify you are human/i.test(corpo) ? 'captcha' : /paywall|subscribe to continue/i.test(corpo) ? 'paywall' : '';
  return {
    url: location.href, origem: location.origin, titulo: document.title, bloqueio,
    busca: busca ? { campo: busca.seletor, formulario: busca.formulario || (formBusca ? unico(formBusca) : null), botao: botaoBusca?.seletor || null, confianca: busca.pontos } : null,
    produtos: card ? { cards: card.seletor, link: card.link, titulo: card.titulo, preco: card.preco, confianca: card.pontos } : null,
    entradas, chat: chatEntradas.length ? { entradas: chatEntradas } : null, confianca,
  };
}

export function observarPaginaLoja({ adaptador } = {}) {
  const texto = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const urlSegura = (valor) => { try { const u = new URL(valor); u.username = ''; u.password = ''; u.search = ''; u.hash = ''; return u.href; } catch { return ''; } };
  const produtos = [];
  const cards = adaptador?.produtos?.cards ? [...document.querySelectorAll(adaptador.produtos.cards)] : [];
  for (const card of cards.slice(0, 24)) {
    const linkEl = adaptador.produtos.link ? card.querySelector(adaptador.produtos.link) : card.querySelector('a[href]');
    const tituloEl = adaptador.produtos.titulo ? card.querySelector(adaptador.produtos.titulo) : card.querySelector('h2,h3,a');
    const precoEl = adaptador.produtos.preco ? card.querySelector(adaptador.produtos.preco) : card.querySelector('[class*="price" i],[class*="preco" i]');
    const titulo = texto(tituloEl) || texto(linkEl);
    if (!titulo) continue;
    produtos.push({ titulo: titulo.slice(0, 240), preco: texto(precoEl).slice(0, 80), url: urlSegura(linkEl?.href || ''), visivel: Boolean(card.offsetWidth || card.offsetHeight || card.getClientRects().length) });
  }
  const produtoAtual = /produto|product|\/p\/|\/item\/|\/dp\//i.test(location.pathname) || new URLSearchParams(location.search).has('produto') || new URLSearchParams(location.search).has('product');
  return { url: urlSegura(location.href), origem: location.origin, titulo: document.title, produtoAtual, produtos, t: Date.now() };
}

export function preencherBuscaLoja({ busca, termo }) {
  const unicoVisivel = (seletor) => { try { const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); return els.length === 1 ? els[0] : null; } catch { return null; } };
  const campo = unicoVisivel(busca?.campo);
  const form = unicoVisivel(busca?.formulario);
  if (!campo || !form || campo.form !== form) return { ok: false, erro: 'campo de busca não encontrado ou não pertence ao formulário mapeado' };
  const alvo = String((campo.getAttribute('type') || '') + ' ' + (campo.getAttribute('placeholder') || '') + ' ' + (campo.getAttribute('aria-label') || '') + ' ' + (campo.getAttribute('name') || '')).toLowerCase();
  if (!campo.matches('input,[role="searchbox"]') || /^(?:email|tel|password|hidden|submit|button)$/.test(campo.type || '') || !(campo.type === 'search' || campo.getAttribute('role') === 'searchbox' || /buscar|busca|pesquis|search|procurar|find/.test(alvo))) return { ok: false, erro: 'o campo mapeado não é uma busca semântica' };
  campo.focus();
  const prototipo = campo.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(campo, String(termo).slice(0, 300));
  campo.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(termo).slice(0, 300) }));
  campo.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}

export function acionarBuscaLoja({ busca }) {
  const unicoVisivel = (seletor) => { try { const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); return els.length === 1 ? els[0] : null; } catch { return null; } };
  const campo = unicoVisivel(busca?.campo), botao = unicoVisivel(busca?.botao), form = unicoVisivel(busca?.formulario);
  if (!campo || !botao || !form || campo.form !== form || (botao.form !== form && !form.contains(botao))) return { ok: false, erro: 'busca mapeada não tem campo e botão únicos no mesmo formulário' };
  const alvo = String((botao.innerText || '') + ' ' + (botao.getAttribute('aria-label') || '') + ' ' + (botao.getAttribute('title') || '')).toLowerCase();
  if (botao.disabled || botao.type === 'reset' || !/buscar|busca|pesquis|search|procurar|find/.test(alvo)) return { ok: false, erro: 'o botão mapeado não é uma busca segura' };
  botao.click();
  return { ok: true };
}

export function interpretarPedidoLoja(texto) {
  const original = String(texto || '').trim();
  const t = normalizarTexto(original);
  const budgetMatch = t.match(/(?:ate|maximo|menos de|por|em)\s*(?:r\$)?\s*(\d[\d.,]*)/);
  const budget = budgetMatch ? parseValorMonetario(budgetMatch[1]) : null;
  const ocasiao = /anivers|niver/.test(t) ? 'aniversario'
    : /natal/.test(t) ? 'natal'
    : /presente/.test(t) ? 'presente'
    : /dia das maes|\bmae\b/.test(t) ? 'maes'
    : /dia dos pais|\bpai\b/.test(t) ? 'pais'
    : /casamento/.test(t) ? 'casamento' : '';
  const categorias = [
    ['fone', /\b(?:fone|fones|headphone|headphones|headset|earbud|earbuds)\b/], ['teclado', /\b(?:teclado|keyboard)\b/], ['mouse', /\b(?:mouse|raton)\b/],
    ['celular', /\b(?:celular|celulares|smartphone|smartphones|iphone|android|telefone|telefones)\b/], ['notebook', /\b(?:notebook|notebooks|laptop)\b/],
    ['tv', /\b(?:tv|televisor|televisores)\b|smart tv/], ['perfume', /\b(?:perfume|colonia)\b/],
    ['roupa', /\b(?:roupa|camisa|camiseta|camisetas|vestido|vestidos|calca|calcas)\b/], ['sapato', /\b(?:sapato|sapatos|tenis|bota|botas)\b/],
    ['cama', /\b(?:cama|colchao|colchoes|travesseiro|travesseiros)\b/], ['mesa', /\b(?:mesa|cadeira|escritorio)\b/],
    ['banho', /\b(?:banho|toalha|toalhas|sabonete|shampoo|xampu)\b/], ['cozinha', /\b(?:cozinha|panela|panelas|fogao|air fryer)\b/],
    ['brinquedo', /\b(?:brinquedo|brinquedos|boneco|boneca|lego)\b/], ['livro', /\b(?:livro|livros|ebook|ebooks)\b/],
  ];
  const achado = categorias.find(([, re]) => re.test(t));
  let termo = original
    .replace(/^(?:quero|preciso|procuro|comprar|achar|encontrar|me indique|indique)\s+/i, '')
    .replace(/^(?:um|uma|uns|umas)\s+/i, '')
    .replace(/^(?:de|para)\s+(?:um|uma|uns|umas)\s+/i, '')
    .replace(/\b(?:até|ate|maximo|máximo|menos de|por|em)\s*(?:r\$)?\s*\d[\d.,]*\s*(?:reais|real)?/gi, ' ')
    .replace(/\b(?:de|para)\s+(?:presente|presentes|natal|aniversario|casamento)\b/gi, ' ')
    .replace(/\b(?:presente|presentes|natal|aniversario|casamento)\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return { original, termo: termo.slice(0, 120), budget: Number.isFinite(budget) ? budget : null, ocasiao, categoria: achado?.[0] || '' };
}

export function abrirEntradaChat({ chat } = {}) {
  for (const entrada of chat?.entradas || []) {
    try { const el = document.querySelector(entrada.seletor); if (el && (el.offsetWidth || el.offsetHeight)) { el.click(); return { ok: true }; } } catch { /* continua */ }
  }
  return { ok: false, erro: 'entrada do chat não encontrada' };
}

export function mapearChatLoja() {
  const visivel = (el) => Boolean(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const texto = (el) => String(el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const normalizarTexto = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const seletorUnico = (el) => {
    if (!el) return null;
    const esc = (v) => window.CSS?.escape ? window.CSS.escape(v) : String(v).replace(/[^a-zA-Z0-9_-]/g, '\\$&');
    const classes = (n) => [...n.classList].filter((c) => c.length < 60 && !/^\d|^[_a-z0-9]{32,}$/i.test(c)).slice(0, 2);
    const teste = (s) => { try { return document.querySelector(s) === el; } catch { return false; } };
    if (el.id && teste('#' + esc(el.id))) return '#' + esc(el.id);
    const testid = el.getAttribute('data-testid');
    if (testid && teste('[data-testid="' + testid.replace(/"/g, '\\"') + '"]')) return '[data-testid="' + testid.replace(/"/g, '\\"') + '"]';
    const nome = el.getAttribute('name');
    if (nome && teste(el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[name="' + nome.replace(/"/g, '\\"') + '"]';
    const aria = el.getAttribute('aria-label');
    if (aria && teste(el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]')) return el.tagName.toLowerCase() + '[aria-label="' + aria.replace(/"/g, '\\"') + '"]';
    const cs = classes(el);
    if (cs.length) { const s = el.tagName.toLowerCase() + cs.map((c) => '.' + esc(c)).join(''); try { if (document.querySelectorAll(s).length === 1) return s; } catch {} }
    const partes = []; let atual = el;
    while (atual && atual !== document.body && partes.length < 5) {
      let p = atual.tagName.toLowerCase(); const cp = classes(atual);
      if (cp.length) p += cp.map((c) => '.' + esc(c)).join('');
      else if (atual.parentElement) { const irmaos = [...atual.parentElement.children].filter((n) => n.tagName === atual.tagName); p += ':nth-of-type(' + (irmaos.indexOf(atual) + 1) + ')'; }
      partes.unshift(p); atual = atual.parentElement;
    }
    return partes.join(' > ') || el.tagName.toLowerCase();
  };
  const semantica = (el) => normalizarTexto((el.getAttribute('placeholder') || '') + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('name') || ''));
  const campoEls = [...document.querySelectorAll('textarea, input:not([type="password"]):not([type="hidden"]):not([type="search"]):not([type="submit"]):not([type="button"]), [contenteditable="true"]')].filter(visivel).map((el) => {
    const contexto = el.closest('form,[id*="chat" i],[class*="chat" i],[class*="message" i],[aria-label*="chat" i]');
    const s = semantica(el);
    const pontos = (/message|mensagem|chat|fale|escreva|escrever|duvida/.test(s) ? .8 : .15) + (contexto ? .2 : 0) + (el.tagName === 'TEXTAREA' || el.isContentEditable ? .1 : 0);
    return { el, pontos };
  }).filter((x) => x.pontos >= .6).sort((a, b) => b.pontos - a.pontos);
  const campoEl = campoEls[0]?.el || null;
  if (!campoEl) return { campo: null, envio: null, resposta: null };
  const form = campoEl.closest('form');
  const caixaCampo = campoEl.getBoundingClientRect();
  const envios = [...document.querySelectorAll('button, [role="button"]')].filter(visivel).map((el) => {
    const alvo = normalizarTexto(texto(el) + ' ' + (el.getAttribute('aria-label') || '') + ' ' + (el.getAttribute('title') || ''));
    const destrutivo = /delete|remove|destroy|excluir|apagar|limpar|clear|cancel|close|fechar|voltar|back|next|anterior/.test(alvo);
    const semantico = /\b(?:enviar|send|responder|reply|perguntar|ask)\b/.test(alvo);
    const mesmoForm = Boolean(form && (el.form === form || form.contains(el)));
    const caixa = el.getBoundingClientRect();
    const perto = Math.hypot(caixaCampo.left - caixa.left, caixaCampo.top - caixa.top) < 500;
    return { el, pontos: (semantico ? .8 : 0) + (mesmoForm ? .35 : 0) + (perto ? .15 : 0), valido: semantico && !destrutivo && el.type !== 'reset' && (mesmoForm || perto) };
  }).filter((x) => x.valido && x.pontos >= .8).sort((a, b) => b.pontos - a.pontos);
  const envioEl = envios[0]?.el || null;
  const respostas = [...document.querySelectorAll('[id*="chatMensagens" i], [data-testid*="message" i], [class*="message" i], [class*="mensagem" i], [class*="response" i], [data-role="log" i]')].filter(visivel).map((el) => {
    const s = normalizarTexto((el.id || '') + ' ' + (el.getAttribute('data-testid') || '') + ' ' + String(el.className || ''));
    return { el, pontos: /chat|mensagem|message|response|resposta|log/.test(s) ? .8 : .2 };
  }).filter((x) => x.pontos >= .8).sort((a, b) => texto(b.el).length - texto(a.el).length);
  const respostaEl = respostas[0]?.el || null;
  return {
    campo: campoEl ? seletorUnico(campoEl) : null,
    envio: envioEl ? seletorUnico(envioEl) : null,
    resposta: respostaEl ? seletorUnico(respostaEl) : null,
  };
}

function elementoUnicoVisivel(seletor) {
  try {
    const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
    return els.length === 1 ? els[0] : null;
  } catch { return null; }
}

export function prepararChatLoja({ campo, texto }) {
  const unicoVisivel = (seletor) => { try { const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); return els.length === 1 ? els[0] : null; } catch { return null; } };
  const el = unicoVisivel(campo);
  if (!el || !el.matches('textarea,input:not([type="password"]):not([type="hidden"]):not([type="search"]),[contenteditable="true"]')) return { ok: false, erro: 'campo do chat não encontrado ou não é único' };
  el.focus();
  if (el.isContentEditable) el.textContent = String(texto).slice(0, 2000);
  else {
    const prototipo = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototipo, 'value').set.call(el, String(texto).slice(0, 2000));
  }
  el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: String(texto).slice(0, 2000) }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return { ok: true };
}

export function acionarChatLoja({ envio, campo }) {
  const unicoVisivel = (seletor) => { try { const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); return els.length === 1 ? els[0] : null; } catch { return null; } };
  const normalizarTexto = (valor) => String(valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const botao = unicoVisivel(envio);
  const el = unicoVisivel(campo);
  if (!botao || !el) return { ok: false, erro: 'campo ou envio do chat não encontrado ou não é único' };
  const alvo = normalizarTexto((botao.innerText || '') + ' ' + (botao.getAttribute('aria-label') || '') + ' ' + (botao.getAttribute('title') || ''));
  if (botao.disabled || botao.type === 'reset' || !/\b(?:enviar|send|responder|reply)\b/.test(alvo) || /delete|remove|excluir|apagar|limpar|clear|cancel|fechar|close|voltar|back/.test(alvo)) return { ok: false, erro: 'o botão mapeado não é um envio seguro' };
  const mesmoForm = Boolean(el.form && (botao.form === el.form || el.form.contains(botao)));
  const a = el.getBoundingClientRect(), b = botao.getBoundingClientRect();
  if (!mesmoForm && Math.hypot(a.left - b.left, a.top - b.top) >= 500) return { ok: false, erro: 'o botão de envio está longe do campo mapeado' };
  botao.click();
  return { ok: true };
}

export function lerRespostaChat({ resposta }) {
  const unicoVisivel = (seletor) => { try { const els = [...document.querySelectorAll(seletor || '')].filter((el) => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); return els.length === 1 ? els[0] : null; } catch { return null; } };
  const el = unicoVisivel(resposta);
  if (!el) return { encontrado: false, assistente: false, texto: '' };
  const assistente = '[data-message-author-role="assistant"], [data-role="assistant" i], [data-testid*="assistant" i], [class~="assistant"], [class~="resposta"], [class*="assistant-message" i], [class*="bot-message" i], [class*="resposta-assistente" i], [class*="resposta-bot" i], [class*="bot-resposta" i]';
  const usuario = '[data-message-author-role="user"], [data-role="user" i], [class~="user"], [class~="usuario"], [class*="user-message" i], [class*="mensagem-usuario" i], [class*="resposta-usuario" i], [class*="user-resposta" i], [class*="human" i]';
  const nos = (el.matches(assistente) ? [el] : [...el.querySelectorAll(assistente)]).filter((no) => {
    if (no.matches(usuario) || no.closest(usuario)) return false;
    const marca = String((no.id || '') + ' ' + String(no.className || '') + ' ' + (no.getAttribute('role') || '') + ' ' + (no.getAttribute('data-message-author-role') || '') + ' ' + (no.getAttribute('data-role') || '')).toLowerCase();
    return !/user|usuario|human|humano|cliente/.test(marca);
  });
  if (!nos.length) return { encontrado: true, assistente: false, texto: '' };
  const textos = nos.map((no) => {
    const copia = no.cloneNode(true);
    copia.querySelectorAll(usuario).forEach((n) => n.remove());
    return String(copia.innerText || copia.textContent || '').trim();
  }).filter(Boolean);
  return { encontrado: true, assistente: true, texto: textos.join('\n').slice(-4000) };
}

function hash(valor) {
  let h = 2166136261;
  for (const c of String(valor)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

export function criarAdaptadorLoja(relatorio, nome = '') {
  if (!relatorio?.busca?.campo) throw new Error('campo de busca não encontrado');
  if (!relatorio?.busca?.botao || !(relatorio.busca.confianca >= .6)) throw new Error('busca semântica e botão do mesmo formulário não encontrados');
  if (!relatorio?.produtos?.cards) throw new Error('cards de produto não encontrados');
  if (relatorio.bloqueio) throw new Error('página bloqueada: ' + relatorio.bloqueio);
  if (relatorio.confianca < .5) throw new Error('confiança insuficiente para mapear a loja');
  return {
    id: 'loja-' + hash(relatorio.origem),
    nome: nome || relatorio.titulo || relatorio.origem,
    url: urlSemParametros(relatorio.url),
    origem: relatorio.origem,
    versao: 1,
    tipo: 'loja',
    descoberta: true,
    confianca: relatorio.confianca,
    busca: relatorio.busca,
    produtos: relatorio.produtos,
    entradas: (relatorio.entradas || []).map((e) => ({ ...e, href: urlSemParametros(e.href || '') })),
    chat: relatorio.chat || null,
  };
}
