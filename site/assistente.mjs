/** WORK — assistente virtual flutuante com MCP, voz e interação com a página. */
const CSS = `
.wa-root{position:fixed;right:18px;bottom:18px;z-index:120;font:500 14px/1.45 "IBM Plex Sans",system-ui,sans-serif;color:var(--tinta,#1b2730)}
.wa-root *{box-sizing:border-box}.wa-root button,.wa-root input{font:inherit}
.wa-olho{position:relative;width:82px;height:82px;border:0;background:transparent;cursor:pointer;padding:0;animation:wa-flutuar 3.8s ease-in-out infinite;filter:drop-shadow(0 10px 16px rgba(20,54,78,.22))}
.wa-rosto{position:absolute;inset:8px;border-radius:50%;background:radial-gradient(circle at 35% 28%,#fff,#dff3ff 48%,#9ed8ff);border:3px solid #1f6fe0;box-shadow:inset 0 -8px 0 rgba(31,111,224,.12),0 0 0 5px rgba(255,255,255,.65);display:grid;place-items:center}
.wa-halo{position:absolute;width:48px;height:13px;border:5px solid #f2c14e;border-radius:50%;left:17px;top:-2px;transform:rotate(-7deg);box-shadow:0 2px 0 rgba(120,80,0,.15)}
.wa-asa{position:absolute;top:27px;width:25px;height:34px;background:#fff;border:2px solid #1f6fe0;z-index:-1}.wa-asa.e{left:-9px;border-radius:70% 20% 70% 30%;transform:rotate(22deg)}.wa-asa.d{right:-9px;border-radius:20% 70% 30% 70%;transform:rotate(-22deg)}
.wa-pupila{position:absolute;top:27px;width:22px;height:28px;border-radius:50%;background:#fff;border:2px solid #17324d;overflow:hidden;transition:transform .18s ease}.wa-pupila.e{left:18px}.wa-pupila.d{right:18px}
.wa-pupila i{position:absolute;width:8px;height:11px;border-radius:50%;background:#17324d;left:5px;top:7px;transition:transform .25s ease}.wa-pupila:after{content:"";position:absolute;width:3px;height:4px;border-radius:50%;background:#fff;left:7px;top:9px}
.wa-boca{position:absolute;width:17px;height:9px;border-bottom:3px solid #17324d;border-radius:0 0 50% 50%;left:29px;bottom:19px}
.wa-root[data-estado="pensando"] .wa-pupila{animation:wa-piscar 1.1s infinite}.wa-root[data-estado="falando"] .wa-boca{animation:wa-boca .32s infinite alternate}
.wa-pulso{position:absolute;right:4px;bottom:4px;width:74px;height:74px;border:2px solid #1f6fe0;border-radius:50%;animation:wa-pulso 2.2s ease-out infinite;pointer-events:none}
.wa-bolha{position:absolute;right:92px;bottom:22px;max-width:220px;background:#fffdf6;color:#17324d;border:2px solid #1f6fe0;border-radius:16px 16px 4px 16px;padding:10px 13px;box-shadow:7px 8px 0 rgba(31,111,224,.14);cursor:pointer;animation:wa-entra .35s ease both}
.wa-bolha b{display:block;font:700 .7rem ui-monospace,monospace;color:#1f6fe0;letter-spacing:.08em;text-transform:uppercase}.wa-bolha span{font-size:.82rem}
.wa-painel{position:absolute;right:0;bottom:98px;width:min(390px,calc(100vw - 28px));height:min(570px,calc(100vh - 130px));background:#fffdf6;border:2px solid #1f6fe0;border-radius:18px;box-shadow:12px 16px 0 rgba(31,111,224,.14),0 22px 60px rgba(15,44,68,.25);overflow:hidden;display:none;flex-direction:column;animation:wa-entra .25s ease}
.wa-painel.on{display:flex}.wa-topo{display:flex;align-items:center;gap:9px;padding:11px 12px;background:#1f6fe0;color:#fff}.wa-topo b{font:700 .78rem ui-monospace,monospace;letter-spacing:.06em}.wa-topo small{margin-left:auto;font:600 .64rem ui-monospace,monospace;opacity:.9}.wa-topo button{border:1px solid rgba(255,255,255,.4);background:transparent;color:#fff;border-radius:6px;cursor:pointer;padding:3px 7px}
.wa-status{display:flex;align-items:center;gap:7px;padding:8px 12px;border-bottom:1px solid #d7e5ef;background:#eaf5ff;color:#174a7c;font:600 .69rem ui-monospace,monospace;min-height:34px}.wa-led{width:7px;height:7px;border-radius:50%;background:#20a46b;box-shadow:0 0 0 3px rgba(32,164,107,.15)}
.wa-msgs{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:9px;background:repeating-linear-gradient(0deg,rgba(31,111,224,.025) 0 1px,transparent 1px 5px)}
.wa-msg{max-width:88%;padding:9px 11px;border-radius:12px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.86rem}.wa-msg.user{align-self:flex-end;background:#1f6fe0;color:#fff;border-bottom-right-radius:3px}.wa-msg.bot{align-self:flex-start;background:#fff;border:1px solid #cfe0ea;border-bottom-left-radius:3px}.wa-msg.erro{background:#fff0ec;border-color:#e7a18f;color:#8a2f1c}
.wa-tool{align-self:center;background:#17324d;color:#cdefff;border-radius:99px;padding:5px 10px;font:600 .66rem ui-monospace,monospace;display:flex;align-items:center;gap:7px}.wa-tool:after{content:"...";letter-spacing:2px;animation:wa-pontos 1s infinite}
.wa-acoes{display:flex;gap:5px;padding:7px 10px;overflow:auto;border-bottom:1px solid #d7e5ef;background:#fff}.wa-acoes button{flex:0 0 auto;border:1px solid #b9cedd;background:#eaf5ff;color:#174a7c;border-radius:99px;padding:5px 9px;cursor:pointer;font:600 .66rem ui-monospace,monospace}.wa-acoes button:hover{background:#1f6fe0;color:#fff}
.wa-form{display:flex;gap:7px;padding:10px;border-top:1px solid #d7e5ef;background:#fff}.wa-form input{flex:1;min-width:0;border:1px solid #b9cedd;border-radius:9px;padding:9px 10px;outline:none;background:#f8fcff;color:#17324d}.wa-form input:focus{border-color:#1f6fe0;box-shadow:0 0 0 3px rgba(31,111,224,.12)}.wa-form button{border:0;border-radius:9px;padding:8px 11px;cursor:pointer;background:#1f6fe0;color:#fff;font-weight:700}.wa-form button.sec{background:#eaf5ff;color:#1f6fe0;border:1px solid #b9cedd}.wa-form button.cancel{background:#fff0ec;color:#a13c28}.wa-form button:disabled{opacity:.45;cursor:not-allowed}
.wa-root .wa-oculto{display:none!important}
@keyframes wa-flutuar{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(2deg)}}
@keyframes wa-pulso{0%{transform:scale(.85);opacity:.65}100%{transform:scale(1.45);opacity:0}}
@keyframes wa-piscar{0%,45%,55%,100%{transform:scaleY(1)}50%{transform:scaleY(.12)}}
@keyframes wa-boca{from{height:4px}to{height:13px}}
@keyframes wa-entra{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
@keyframes wa-pontos{0%{opacity:.3}50%{opacity:1}100%{opacity:.3}}
@media(max-width:520px){.wa-root{right:10px;bottom:10px}.wa-bolha{right:80px;bottom:16px;max-width:170px}.wa-olho{width:72px;height:72px}.wa-painel{bottom:86px}.wa-halo{left:12px}.wa-pupila.e{left:14px}.wa-pupila.d{right:14px}.wa-boca{left:25px;bottom:16px}}
`;

const INTRO = 'Oi, eu sou WORK, o assistente virtual do Myn Recicla/01. Posso conversar, pesquisar, consultar rotas, gerar mídia, usar ferramentas MCP e navegar pela página. Clique na bolha para falar comigo.';
let ferramentas = [];
let apresentado = sessionStorage.getItem('work-apresentado') === '1';
let somAtivo = localStorage.getItem('work-som') !== '0';
let vozAtiva = localStorage.getItem('work-voz') !== '0';
let audioCtx = null, reconhecimento = null, ocupado = false, controleAtual = null, tokenMcp = null;
const HISTORICO = 'work-chat-v1';

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function tocarSom() {
  if (!somAtivo) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const agora = audioCtx.currentTime;
    [659, 880, 1175].forEach((hz, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, agora + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.08, agora + i * 0.09 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, agora + i * 0.09 + 0.28);
      o.connect(g).connect(audioCtx.destination); o.start(agora + i * 0.09); o.stop(agora + i * 0.09 + 0.3);
    });
  } catch { /* áudio bloqueado */ }
}

function falar(texto) {
  if (!vozAtiva || !('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(String(texto).replace(/!\[[^\]]*\]\([^)]+\)/g, 'imagem gerada').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 900));
  u.lang = 'pt-BR'; u.rate = 1.04; u.pitch = 1.08;
  const root = document.getElementById('work-assistente');
  u.onstart = () => root?.setAttribute('data-estado', 'falando');
  u.onend = () => root?.setAttribute('data-estado', 'online');
  u.onerror = () => root?.setAttribute('data-estado', 'online');
  speechSynthesis.speak(u);
}

function apresentar(forcar = false) {
  if (apresentado && !forcar) return;
  apresentado = true;
  sessionStorage.setItem('work-apresentado', '1');
  const bolha = document.getElementById('waBolha');
  if (bolha) bolha.querySelector('span').textContent = 'Oi, eu sou WORK. Clique para conversar.';
  if (!document.querySelector('#waMsgs .wa-msg.bot')) msg(INTRO, 'bot');
}

async function rpc(metodo, params = {}, signal) {
  const chamar = () => fetch('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(tokenMcp ? { authorization: 'Bearer ' + tokenMcp } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: metodo, params }),
    signal: signal || AbortSignal.timeout(180000),
  });
  let r = await chamar();
  if (r.status === 401 && !tokenMcp) {
    tokenMcp = await fetch('/api/token').then((x) => x.json()).then((d) => d.token);
    r = await chamar();
  }
  const d = await r.json();
  if (d.error) throw new Error(d.error.message || 'erro MCP');
  return d.result;
}

function abrir() { apresentar(); document.getElementById('work-assistente')?.classList.add('aberto'); document.getElementById('waPainel')?.classList.add('on'); document.getElementById('waBolha')?.classList.add('wa-oculto'); setTimeout(() => document.getElementById('waInput')?.focus(), 80); tocarSom(); }
function fechar() { document.getElementById('work-assistente')?.classList.remove('aberto'); document.getElementById('waPainel')?.classList.remove('on'); document.getElementById('waBolha')?.classList.remove('wa-oculto'); }

function msg(texto, tipo = 'bot', persistir = true) {
  const area = document.getElementById('waMsgs');
  const el = document.createElement('div'); el.className = 'wa-msg ' + tipo;
  const imagens = String(texto).match(/!\[[^\]]*\]\(([^)]+)\)/g) || [];
  const audioUrl = /\[🔊 áudio\]\(([^)]+)\)/.exec(String(texto))?.[1];
  const videoUrl = /\[🎬 vídeo\]\(([^)]+)\)/.exec(String(texto))?.[1];
  const limpo = String(texto).replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/\[🔊 áudio\]\([^)]+\)/g, '').replace(/\[🎬 vídeo\]\([^)]+\)/g, '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  el.textContent = limpo;
  for (const md of imagens) {
    const url = /\(([^)]+)\)/.exec(md)?.[1];
    if (url && /^https?:\/\//.test(url)) { const img = document.createElement('img'); img.src = url; img.alt = 'mídia gerada'; img.style.cssText = 'max-width:100%;border-radius:8px;margin-top:7px'; el.appendChild(img); }
  }
  if (audioUrl && /^https?:\/\//.test(audioUrl)) { const a = document.createElement('audio'); a.controls = true; a.src = audioUrl; a.style.cssText = 'width:100%;margin-top:7px'; el.appendChild(a); }
  if (videoUrl && /^https?:\/\//.test(videoUrl)) { const v = document.createElement('video'); v.controls = true; v.src = videoUrl; v.style.cssText = 'width:100%;border-radius:8px;margin-top:7px'; el.appendChild(v); }
  area?.appendChild(el); area?.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
  if (persistir) try {
    const h = JSON.parse(localStorage.getItem(HISTORICO) || '[]');
    h.push({ tipo, texto: limpo });
    localStorage.setItem(HISTORICO, JSON.stringify(h.slice(-40)));
  } catch { /* armazenamento indisponível */ }
}

function estado(texto, modo = 'online') {
  const root = document.getElementById('work-assistente');
  root?.setAttribute('data-estado', modo);
  const st = document.getElementById('waStatus'); if (st) st.textContent = texto;
  const bolha = document.getElementById('waBolha');
  if (bolha) bolha.querySelector('span').textContent = (!root?.classList.contains('aberto') && apresentado && modo === 'online')
    ? 'Oi, eu sou WORK. Clique para conversar.' : texto;
}

async function ferramenta(nome, args = {}) {
  estado('🔧 ' + nome, 'pensando');
  const chip = document.createElement('div'); chip.className = 'wa-tool'; chip.textContent = '🔧 ' + nome;
  document.getElementById('waMsgs')?.appendChild(chip);
  const result = await rpc('tools/call', { name: nome, arguments: args }, controleAtual?.signal);
  chip.remove();
  const texto = result?.content?.map((c) => c.text || '').join('\n') || 'Concluído.';
  if (result?.isError) throw new Error(texto);
  return texto;
}

function interagirPagina(texto) {
  const t = texto.toLowerCase();
  const mapa = { catalogo: 'catalogo', catálogo: 'catalogo', plugins: 'extras', bancada: 'bancada', worker: 'bancada', ciclo: 'como', sobre: 'sobre', autor: 'autor', criador: 'autor' };
  if (/volta|voltar/.test(t) && /inicial|início|inicio|home/.test(t)) {
    window.location.href = '/';
    return 'Voltando para a tela inicial.';
  }
  if (/abrir|ir|mostrar|rolar|levar|voltar/.test(t)) {
    if (t.includes('playground')) { window.open('/playground.html', '_blank', 'noopener'); return 'Abri o Playground /01 em uma nova aba.'; }
    for (const [chave, id] of Object.entries(mapa)) if (t.includes(chave)) {
      const alvo = document.getElementById(id); if (alvo) { alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); alvo.animate([{ outline: '4px solid #f2c14e' }, { outline: '0 solid transparent' }], { duration: 1800 }); return 'Levei você até ' + id + '.'; }
    }
  }
  return null;
}

function decidir(texto) {
  const t = texto.toLowerCase();
  if (/gerar|criar|fazer/.test(t) && /imagem|foto|desenho|ilustra/.test(t)) return { nome: 'myn_imagem', args: { prompt: texto } };
  if (/gerar|criar|fazer/.test(t) && /vídeo|video|clipe|anima/.test(t)) return { nome: 'myn_video', args: { prompt: texto, segundos: 6 } };
  if (/fale|narre|narrar|áudio|audio|voz/.test(t)) return { nome: 'myn_audio', args: { prompt: texto.replace(/^(fale|narre|narrar)\s*/i, '') } };
  if (/histórico|historico|caderno/.test(t)) return { nome: 'myn_historico', args: { limite: 8 } };
  if (/pesquis|fontes|fonte|documenta/.test(t)) return { nome: 'myn_pesquisar', args: { query: texto.replace(/^(pesquise|pesquisa|busque|buscar)\s*/i, '') } };
  if (/rotas|plugins|saúde|saude|modelos/.test(t)) return { nome: 'myn_rotas', args: {} };
  return { nome: 'myn_chat', args: { message: texto, rota: 'auto' } };
}

async function enviar(texto) {
  if (!texto.trim() || ocupado) return;
  ocupado = true; controleAtual = new AbortController();
  document.getElementById('waSend').disabled = true;
  document.getElementById('waCancelar').disabled = false;
  msg(texto, 'user');
  try {
    const pagina = interagirPagina(texto);
    if (pagina) { estado('🧭 interagir_pagina', 'pensando'); await new Promise((r) => setTimeout(r, 450)); msg(pagina); falar(pagina); }
    else { const d = decidir(texto); const resposta = await ferramenta(d.nome, d.args); msg(resposta); falar(resposta); }
    estado('online · ' + ferramentas.length + ' ferramentas MCP');
  } catch (e) {
    if (controleAtual?.signal.aborted) { msg('Chamada cancelada.', 'erro'); estado('online · ' + ferramentas.length + ' ferramentas MCP'); }
    else { msg('Não consegui concluir: ' + e.message, 'erro'); estado('offline · ' + e.message); }
  } finally {
    ocupado = false; controleAtual = null;
    document.getElementById('waSend').disabled = false;
    document.getElementById('waCancelar').disabled = true;
    document.getElementById('waInput').focus();
  }
}

async function processarAnexo(file) {
  if (!file || ocupado) return;
  if (file.size > 12 * 1024 * 1024) { msg('Arquivo acima de 12 MB.', 'erro'); return; }
  ocupado = true; controleAtual = new AbortController();
  document.getElementById('waSend').disabled = true;
  document.getElementById('waCancelar').disabled = false;
  msg('📎 ' + file.name, 'user');
  try {
    estado('📎 myn_documento', 'pensando');
    const base64 = await new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onload = () => resolve(String(leitor.result).split(',')[1] || '');
      leitor.onerror = () => reject(leitor.error || new Error('falha ao ler arquivo'));
      leitor.readAsDataURL(file);
    });
    const resposta = await ferramenta('myn_documento', { nome: file.name, base64 });
    msg(resposta); falar(resposta);
    estado('online · ' + ferramentas.length + ' ferramentas MCP');
  } catch (e) {
    if (controleAtual?.signal.aborted) { msg('Leitura cancelada.', 'erro'); estado('online · ' + ferramentas.length + ' ferramentas MCP'); }
    else { msg('Não consegui ler o anexo: ' + e.message, 'erro'); estado('offline · ' + e.message); }
  } finally {
    ocupado = false; controleAtual = null;
    document.getElementById('waSend').disabled = false;
    document.getElementById('waCancelar').disabled = true;
    document.getElementById('waArquivo').value = '';
  }
}

function iniciarVoz() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const botao = document.getElementById('waMic');
  if (!SR) { botao.disabled = true; botao.title = 'Reconhecimento de voz indisponível neste navegador'; return; }
  reconhecimento = new SR(); reconhecimento.lang = 'pt-BR'; reconhecimento.interimResults = false;
  reconhecimento.onresult = (e) => { const texto = e.results[0][0].transcript; document.getElementById('waInput').value = texto; enviar(texto); };
  reconhecimento.onend = () => { botao.classList.remove('sec'); botao.textContent = '🎙'; };
  botao.onclick = () => { if (ocupado) return; try { reconhecimento.start(); botao.classList.add('sec'); botao.textContent = '...'; } catch { /* já ativo */ } };
}

export function iniciarAssistente() {
  if (document.getElementById('work-assistente')) return;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const root = document.createElement('div'); root.id = 'work-assistente'; root.className = 'wa-root'; root.dataset.estado = 'online';
  root.innerHTML = `
   <div class="wa-pulso"></div>
   <button class="wa-olho" id="waOlho" aria-label="Abrir assistente WORK">
    <span class="wa-halo"></span><span class="wa-asa e"></span><span class="wa-asa d"></span>
    <span class="wa-rosto"><span class="wa-pupila e"><i></i></span><span class="wa-pupila d"><i></i></span><span class="wa-boca"></span></span>
   </button>
   <button class="wa-bolha" id="waBolha"><b>WORK · assistente MCP</b><span>Clique e fale comigo</span></button>
   <section class="wa-painel" id="waPainel" aria-label="Mini chat do WORK">
    <div class="wa-topo"><b>WORK /01</b><small id="waTools">conectando MCP...</small><button id="waSom" title="Ativar/desativar som">${somAtivo ? '🔔' : '🔕'}</button><button id="waVoz" title="Ativar/desativar voz">${vozAtiva ? '🗣' : '🤐'}</button><button id="waLimpar" title="Limpar conversa">🧹</button><button id="waFechar" aria-label="Fechar">✕</button></div>
    <div class="wa-status"><span class="wa-led"></span><span id="waStatus">online</span></div>
    <div class="wa-acoes"><button data-acao="quais são as rotas?">ver rotas</button><button data-acao="pesquise worker">pesquisar</button><button data-acao="ir para catálogo">ir ao catálogo</button><button data-acao="explique o que é o Myn">sobre o Myn</button></div>
    <div class="wa-msgs" id="waMsgs"><div class="wa-msg bot">Oi, eu sou o WORK. Posso conversar, pesquisar, consultar rotas, gerar mídia e navegar pela página. As ferramentas MCP aparecem aqui enquanto eu uso.</div></div>
    <form class="wa-form" id="waForm"><input type="file" id="waArquivo" hidden accept=".txt,.md,.csv,.json,.html,.pdf,.png,.jpg,.jpeg,.webp"><input id="waInput" autocomplete="off" placeholder="Escreva ou use o microfone..."><button type="button" class="sec" id="waAnexar" title="Anexar documento ou imagem">📎</button><button type="button" class="sec" id="waMic" title="Falar">🎙</button><button type="button" class="cancel" id="waCancelar" title="Cancelar chamada" disabled>■</button><button id="waSend" type="submit">ENVIAR</button></form>
   </section>`;
  document.body.appendChild(root);
  try {
    const historico = JSON.parse(localStorage.getItem(HISTORICO) || '[]');
    for (const m of historico.slice(-40)) msg(m.texto, m.tipo === 'user' ? 'user' : 'bot', false);
  } catch { /* sem histórico */ }
  document.getElementById('waOlho').onclick = abrir; document.getElementById('waBolha').onclick = abrir; document.getElementById('waFechar').onclick = fechar;
  document.getElementById('waForm').onsubmit = (e) => { e.preventDefault(); const input = document.getElementById('waInput'); enviar(input.value); input.value = ''; };
  document.querySelectorAll('.wa-acoes button').forEach((b) => { b.onclick = () => enviar(b.dataset.acao); });
  document.getElementById('waAnexar').onclick = () => document.getElementById('waArquivo').click();
  document.getElementById('waArquivo').onchange = (e) => processarAnexo(e.target.files?.[0]);
  document.getElementById('waCancelar').onclick = () => controleAtual?.abort();
  document.getElementById('waLimpar').onclick = () => {
    localStorage.removeItem(HISTORICO);
    const area = document.getElementById('waMsgs'); area.innerHTML = '';
    msg(INTRO, 'bot');
    estado('online · conversa limpa');
  };
  document.getElementById('waSom').onclick = (e) => { somAtivo = !somAtivo; localStorage.setItem('work-som', somAtivo ? '1' : '0'); e.currentTarget.textContent = somAtivo ? '🔔' : '🔕'; if (somAtivo) tocarSom(); };
  document.getElementById('waVoz').onclick = (e) => { vozAtiva = !vozAtiva; localStorage.setItem('work-voz', vozAtiva ? '1' : '0'); e.currentTarget.textContent = vozAtiva ? '🗣' : '🤐'; if (vozAtiva) falar(INTRO); else speechSynthesis?.cancel(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  iniciarVoz();
  setInterval(() => { if (ocupado) return; const x = Math.round((Math.random() - .5) * 7), y = Math.round((Math.random() - .5) * 5); document.querySelectorAll('.wa-pupila i').forEach((i) => { i.style.transform = `translate(${x}px,${y}px)`; }); }, 2600);
  apresentar();
  let primeiroGest = true;
  document.addEventListener('pointerdown', () => {
    if (!primeiroGest) return;
    primeiroGest = false;
    tocarSom();
    setTimeout(() => { apresentar(); falar(INTRO); }, 650);
  }, { once: true });
  rpc('tools/list').then((r) => { ferramentas = r.tools || []; document.getElementById('waTools').textContent = ferramentas.length + ' tools MCP'; estado('online · ' + ferramentas.length + ' ferramentas MCP'); }).catch((e) => { document.getElementById('waTools').textContent = 'MCP offline'; estado('MCP offline · ' + e.message); });
  window.WORK = { abrir, fechar, apresentar, cancelar: () => controleAtual?.abort(), ferramentas: () => ferramentas, enviar };
}

iniciarAssistente();
