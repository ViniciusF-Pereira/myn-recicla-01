/** Mídia 100% navegador: Canvas, MediaRecorder, WebAudio, SpeechSynthesis e bibliotecas web. */

export function capacidade() {
  return {
    canvas: !!document.createElement('canvas').getContext,
    mediaRecorder: typeof MediaRecorder !== 'undefined',
    capturaVideo: typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype,
    voz: 'speechSynthesis' in window,
    microfone: navigator.mediaDevices?.getUserMedia != null,
    webgpu: !!navigator.gpu,
  };
}

function blobUrl(blob) { return URL.createObjectURL(blob); }

function desenharFallback(prompt, largura = 768, altura = 768) {
  const canvas = document.createElement('canvas'); canvas.width = largura; canvas.height = altura;
  const c = canvas.getContext('2d');
  const grad = c.createLinearGradient(0, 0, largura, altura);
  grad.addColorStop(0, '#1f6fe0'); grad.addColorStop(.55, '#12a89d'); grad.addColorStop(1, '#f2c14e');
  c.fillStyle = grad; c.fillRect(0, 0, largura, altura);
  c.fillStyle = 'rgba(255,255,255,.16)';
  for (let i = 0; i < 9; i++) { c.beginPath(); c.arc((i * 173) % largura, (i * 97) % altura, 35 + i * 9, 0, Math.PI * 2); c.fill(); }
  c.fillStyle = '#fffdf6'; c.font = '600 34px system-ui'; c.textAlign = 'center';
  const palavras = String(prompt).split(/\s+/).slice(0, 7); let linha = '';
  const linhas = [];
  for (const p of palavras) { if ((linha + p).length > 24) { linhas.push(linha); linha = ''; } linha += p + ' '; }
  if (linha) linhas.push(linha);
  linhas.forEach((l, i) => c.fillText(l.trim(), largura / 2, altura / 2 - 30 + i * 46));
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

export async function gerarImagem(prompt, { largura = 768, altura = 768 } = {}) {
  const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=' + largura + '&height=' + altura + '&nologo=true&seed=' + Math.floor(Math.random() * 1e9);
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('Pollinations ' + r.status);
    const blob = await r.blob();
    if (!blob.type.startsWith('image/')) throw new Error('resposta não é imagem');
    return { tipo: 'imagem', url: blobUrl(blob), blob, fonte: 'Pollinations · serviço web' };
  } catch (e) {
    const blob = await desenharFallback(prompt, largura, altura);
    return { tipo: 'imagem', url: blobUrl(blob), blob, fonte: 'Canvas local · fallback: ' + e.message };
  }
}

export function narrar(texto, { voz = 'pt-BR-FranciscaNeural', taxa = 1, tom = 1.05 } = {}) {
  if (!('speechSynthesis' in window)) return Promise.reject(new Error('SpeechSynthesis indisponível'));
  return new Promise((resolve, reject) => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(texto).slice(0, 4000));
    const vv = speechSynthesis.getVoices().find((v) => v.lang.startsWith('pt-BR')) || speechSynthesis.getVoices()[0];
    if (vv) u.voice = vv;
    u.lang = 'pt-BR'; u.rate = taxa; u.pitch = tom;
    u.onend = () => resolve({ tipo: 'audio', fonte: 'SpeechSynthesis · navegador', voz: vv?.name || voz, semUrl: true });
    u.onerror = (e) => reject(new Error(e.error || 'falha na síntese de voz'));
    speechSynthesis.speak(u);
  });
}

export async function gravarNarracao(texto) {
  if (!navigator.mediaDevices?.getDisplayMedia || typeof MediaRecorder === 'undefined') throw new Error('gravação de áudio indisponível');
  const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: false });
  const chunks = [], rec = new MediaRecorder(stream);
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const fim = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(100);
  await narrar(texto);
  rec.stop(); stream.getTracks().forEach((t) => t.stop());
  await fim;
  const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
  return { tipo: 'audio', url: blobUrl(blob), blob, fonte: 'MediaRecorder + SpeechSynthesis', semUrl: false };
}

export async function gerarVideo(prompt, { segundos = 6, largura = 960, altura = 540 } = {}) {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) throw new Error('Canvas/MediaRecorder indisponível');
  const canvas = document.createElement('canvas'); canvas.width = largura; canvas.height = altura;
  const c = canvas.getContext('2d');
  const stream = canvas.captureStream(30);
  const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = []; rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const fim = new Promise((resolve) => { rec.onstop = resolve; });
  rec.start(100);
  const t0 = performance.now();
  await new Promise((resolve) => {
    function quadro(agora) {
      const p = Math.min(1, (agora - t0) / (segundos * 1000));
      const g = c.createLinearGradient(0, 0, largura, altura); g.addColorStop(0, '#1f6fe0'); g.addColorStop(1, '#12a89d');
      c.fillStyle = g; c.fillRect(0, 0, largura, altura);
      c.fillStyle = 'rgba(242,193,78,.9)'; c.beginPath(); c.arc(largura * (.25 + p * .5), altura * .45, 80, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fffdf6'; c.font = '600 30px system-ui'; c.textAlign = 'center'; c.fillText(String(prompt).slice(0, 48), largura / 2, altura * .78);
      if (p < 1) requestAnimationFrame(quadro); else resolve();
    }
    requestAnimationFrame(quadro);
  });
  rec.stop(); stream.getTracks().forEach((t) => t.stop()); await fim;
  const blob = new Blob(chunks, { type: rec.mimeType || 'video/webm' });
  return { tipo: 'video', url: blobUrl(blob), blob, fonte: 'Canvas + MediaRecorder · navegador' };
}

export async function gerarGif(prompt, opcoes = {}) {
  const r = await gerarVideo(prompt, { ...opcoes, segundos: Math.min(4, opcoes.segundos || 3) });
  return { ...r, tipo: 'gif', observacao: 'animação WebM (MediaRecorder não gera GIF nativo)' };
}

function carregarScript(url) {
  return new Promise((resolve, reject) => {
    const existente = document.querySelector('script[data-myn-lib="' + url + '"]');
    if (existente) { if (existente.dataset.carregado === '1') return resolve(); existente.addEventListener('load', resolve, { once: true }); existente.addEventListener('error', reject, { once: true }); return; }
    const s = document.createElement('script'); s.src = url; s.dataset.mynLib = url; s.onload = () => { s.dataset.carregado = '1'; resolve(); }; s.onerror = reject; document.head.appendChild(s);
  });
}

export async function extrairImagem(file) {
  await carregarScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const r = await window.Tesseract.recognize(file, 'eng+por', { logger: () => {} });
  return r.data.text.trim();
}

export async function extrairPDF(file) {
  const pdfjs = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const partes = [];
  for (let i = 1; i <= Math.min(doc.numPages, 30); i++) {
    const page = await doc.getPage(i); const txt = await page.getTextContent();
    partes.push(txt.items.map((x) => x.str).join(' '));
  }
  return partes.join('\n\n').slice(0, 60000);
}

export async function extrairArquivo(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  let texto = '', aviso = '';
  try {
    if (['txt', 'md', 'csv', 'json', 'html', 'xml', 'yaml', 'yml', 'log'].includes(ext)) texto = await file.text();
    else if (ext === 'pdf') texto = await extrairPDF(file);
    else if (['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) texto = await extrairImagem(file);
    else aviso = 'formato sem extrator web; arquivo apenas anexado';
  } catch (e) { aviso = 'extrator web indisponível: ' + e.message; }
  return { nome: file.name, texto: texto.slice(0, 60000), aviso, url: blobUrl(file), tamanho: file.size };
}

export function baixar(blob, nome) {
  const a = document.createElement('a'); a.href = blobUrl(blob); a.download = nome; a.click();
}
