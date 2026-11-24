/** Mídia e documentos gratuitos: Pollinations, edge-tts, ffmpeg local, pypdf/Tesseract. */
import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const executar = promisify(execFile);
const RAIZ = process.cwd();
export const DIR_ARQUIVOS = path.join(RAIZ, 'dados', 'arquivos');
await mkdir(DIR_ARQUIVOS, { recursive: true });
const TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe';
const LIMITE = 12 * 1024 * 1024;
const seguro = (nome) => String(nome || 'arquivo').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 90) || 'arquivo';

export async function salvarArquivo(nome, bytes) {
  if (bytes.length > LIMITE) throw new Error('arquivo acima de 12 MB');
  const n = seguro(nome);
  await writeFile(path.join(DIR_ARQUIVOS, n), bytes);
  return n;
}
export async function listarArquivos() {
  const nomes = await readdir(DIR_ARQUIVOS);
  const todos = await Promise.all(nomes.map(async (nome) => {
    const s = await stat(path.join(DIR_ARQUIVOS, nome)).catch(() => null);
    return { nome, bytes: s?.size || 0, em: s?.mtime?.toISOString() || null };
  }));
  return todos.filter((x) => x.bytes > 0).sort((a, b) => String(b.em).localeCompare(String(a.em)));
}
export async function lerArquivo(nome) {
  const alvo = path.join(DIR_ARQUIVOS, seguro(nome));
  if (!alvo.startsWith(DIR_ARQUIVOS)) throw new Error('fora do diretorio');
  return readFile(alvo);
}

/** Texto de txt/md/csv/json/html; PDF via pypdf; imagem via Tesseract; áudio/vídeo: aviso honesto. */
export async function extrairDocumento(nome, base64) {
  const n = seguro(nome);
  const bytes = Buffer.from(String(base64 || '').replace(/^data:[^;]+;base64,/, ''), 'base64');
  if (!bytes.length) throw new Error('arquivo vazio');
  const salvo = await salvarArquivo(n, bytes);
  const ext = path.extname(salvo).toLowerCase();
  let texto = '', aviso = '';
  try {
    if (['.txt','.md','.csv','.json','.html','.htm','.log','.xml','.yaml','.yml'].includes(ext)) {
      texto = bytes.toString('utf8').slice(0, 60000);
    } else if (ext === '.pdf') {
      const tmp = path.join(DIR_ARQUIVOS, 'tmp-' + Date.now() + '.pdf');
      await writeFile(tmp, bytes);
      const codigo = "import sys;from pypdf import PdfReader;r=PdfReader(sys.argv[1]);print('\\n'.join((p.extract_text() or '') for p in r.pages[:60]))";
      texto = (await executar('python', ['-c', codigo, tmp], { timeout: 90000 })).stdout.slice(0, 60000);
      await unlink(tmp).catch(() => {});
    } else if (['.png','.jpg','.jpeg','.webp','.bmp'].includes(ext)) {
      const tmp = path.join(DIR_ARQUIVOS, 'tmp-' + Date.now() + '.jpg');
      await writeFile(tmp, bytes);
      texto = (await executar(TESSERACT, [tmp, 'stdout', '-l', 'eng+por'], { timeout: 90000 })).stdout.slice(0, 60000);
      await unlink(tmp).catch(() => {});
    } else if (['.mp3','.wav','.ogg','.m4a','.mp4','.webm'].includes(ext)) {
      aviso = 'Áudio/vídeo salvo, mas não transcrito. Use 🔊 para narração a partir de texto.';
    } else {
      texto = bytes.toString('utf8').slice(0, 20000);
      aviso = 'Formato tratado como texto bruto.';
    }
  } catch (erro) { aviso = 'Não foi possível extrair texto: ' + String(erro.message).slice(0, 120); }
  return { nome: salvo, texto: texto.trim(), aviso, url: '/api/arquivos/' + encodeURIComponent(salvo) };
}

/** Fallback local: desenha o SUJEITO do prompt por palavra-chave, com PIL. Sem rede, sem chave. */
async function gerarImagemLocal(prompt, largura, altura) {
  const nome = 'imagem-local-' + Date.now() + '.jpg';
  const destino = path.join(DIR_ARQUIVOS, nome);
  const codigo = [
    'from PIL import Image, ImageDraw',
    'import sys, random, hashlib',
    'w,h=int(sys.argv[1]),int(sys.argv[2]); prompt=sys.argv[3]',
    'seed=int(hashlib.md5(prompt.encode()).hexdigest()[:8],16); random.seed(seed)',
    'p=prompt.lower()',
    'im=Image.new("RGB",(w,h)); d=ImageDraw.Draw(im)',
    'INK=(27,36,48); CREAM=(255,250,240); MUST=(217,154,47); BLUE=(31,111,224); CORAL=(239,111,94)',
    'for y in range(h):',
    ' t=y/h; d.line((0,y,w,y),fill=(int(31+213*t),int(111+128*t),int(224+3*t)))',
    'd.ellipse((w*0.36,h*0.12,w*0.64,h*0.40),fill=MUST,outline=INK,width=3)',
    'for _ in range(9):',
    ' x=random.randint(-80,w); y=random.randint(int(h*0.06),int(h*0.45)); rw=random.randint(60,150); rh=random.randint(20,45)',
    ' d.ellipse((x,y,x+rw,y+rh),fill=CREAM,outline=(199,210,222),width=1)',
    'd.rectangle((0,int(h*0.78),w,h),fill=(18,34,51))',
    'for i in range(0,w,11): d.line((i,int(h*0.80),i+30,h),fill=CREAM,width=1)',
    'def olhos(cx,cy,sep,tam):',
    ' d.ellipse((cx-sep-tam,cy-tam,cx-sep+tam,cy+tam),fill=CREAM,outline=INK,width=2)',
    ' d.ellipse((cx+sep-tam,cy-tam,cx+sep+tam,cy+tam),fill=CREAM,outline=INK,width=2)',
    ' d.ellipse((cx-sep-tam*0.3,cy-tam*0.3,cx-sep+tam*0.3,cy+tam*0.3),fill=INK)',
    ' d.ellipse((cx+sep-tam*0.3,cy-tam*0.3,cx+sep+tam*0.3,cy+tam*0.3),fill=INK)',
    'cx,cy=w*0.5,h*0.60; S=min(w,h)*0.16',
    'moicano=any(k in p for k in ("moicano","mohawk","punk","topete"))',
    'if any(k in p for k in ("cachorro","dog","cao","cão")):',
    ' d.ellipse((cx-S,cy-S*0.8,cx+S,cy+S*0.9),fill=CREAM,outline=INK,width=4)',
    ' d.polygon([(cx-S,cy-S*0.5),(cx-S*1.5,cy-S*1.3),(cx-S*0.7,cy-S*0.2)],fill=CREAM,outline=INK)',
    ' d.polygon([(cx+S,cy-S*0.5),(cx+S*1.5,cy-S*1.3),(cx+S*0.7,cy-S*0.2)],fill=CREAM,outline=INK)',
    ' d.ellipse((cx-S*0.45,cy+S*0.05,cx+S*0.45,cy+S*0.65),fill=CREAM,outline=INK,width=3)',
    ' olhos(cx,cy-S*0.25,S*0.42,S*0.16); d.ellipse((cx-S*0.12,cy+S*0.25,cx+S*0.12,cy+S*0.42),fill=INK)',
    ' if moicano:',
    '  for i in range(-2,3):',
    '   x=cx+i*S*0.25; d.polygon([(x-S*0.10,cy-S*0.78),(x,cy-S*1.45-abs(i)*S*0.12),(x+S*0.10,cy-S*0.78)],fill=CORAL,outline=INK)',
    'elif any(k in p for k in ("gato","cat","gatinho")):',
    ' d.ellipse((cx-S,cy-S*0.8,cx+S,cy+S*0.9),fill=CREAM,outline=INK,width=4)',
    ' d.polygon([(cx-S*0.8,cy-S*0.6),(cx-S*0.9,cy-S*1.5),(cx-S*0.15,cy-S*0.8)],fill=CREAM,outline=INK)',
    ' d.polygon([(cx+S*0.8,cy-S*0.6),(cx+S*0.9,cy-S*1.5),(cx+S*0.15,cy-S*0.8)],fill=CREAM,outline=INK)',
    ' olhos(cx,cy-S*0.1,S*0.4,S*0.14)',
    ' for sgn in (-1,1):',
    '  for j in (-1,0,1): d.line((cx+sgn*S*0.35,cy+S*0.25+j*S*0.10,cx+sgn*S*1.15,cy+S*0.10+j*S*0.20),fill=INK,width=2)',
    ' if moicano:',
    '  for i in range(-1,2): d.polygon([(cx+i*S*0.28-S*0.09,cy-S*0.78),(cx+i*S*0.28,cy-S*1.4),(cx+i*S*0.28+S*0.09,cy-S*0.78)],fill=CORAL,outline=INK)',
    'elif any(k in p for k in ("rato","rat","ratinho")):',
    ' d.ellipse((cx-S,cy-S*0.7,cx+S,cy+S*0.8),fill=CREAM,outline=INK,width=4)',
    ' for sgn in (-1,1): d.ellipse((cx+sgn*S*0.65-S*0.4,cy-S*1.0,cx+sgn*S*0.65+S*0.4,cy-S*0.2),fill=CORAL,outline=INK,width=3)',
    ' olhos(cx,cy-S*0.15,S*0.35,S*0.12)',
    ' d.arc((cx+S*0.6,cy+S*0.25,cx+S*2.2,cy+S*1.1),20,300,fill=INK,width=3)',
    'elif any(k in p for k in ("carro","car","auto")):',
    ' d.rectangle((cx-S*1.5,cy-S*0.4,cx+S*1.5,cy+S*0.5),fill=BLUE,outline=INK,width=4)',
    ' d.polygon([(cx-S*0.8,cy-S*0.4),(cx-S*0.3,cy-S*1.1),(cx+S*0.5,cy-S*1.1),(cx+S*1.0,cy-S*0.4)],fill=BLUE,outline=INK)',
    ' for x in (cx-S*0.9,cx+S*0.9): d.ellipse((x-S*0.35,cy+S*0.35,x+S*0.35,cy+S*1.05),fill=INK)',
    'elif any(k in p for k in ("casa","house","moradia")):',
    ' d.rectangle((cx-S,cy-S*0.2,cx+S,cy+S),fill=CREAM,outline=INK,width=4)',
    ' d.polygon([(cx-S*1.2,cy-S*0.2),(cx,cy-S*1.2),(cx+S*1.2,cy-S*0.2)],fill=CORAL,outline=INK)',
    ' d.rectangle((cx-S*0.2,cy+S*0.35,cx+S*0.2,cy+S),fill=BLUE,outline=INK)',
    'else:',
    ' d.ellipse((cx-S,cy-S,cx+S,cy+S),fill=CREAM,outline=INK,width=4)',
    ' olhos(cx,cy-S*0.1,S*0.4,S*0.15)',
    'for sgn in (-1,1): d.line((cx+sgn*S*0.7,cy+S*0.8,cx+sgn*S*0.7,cy+S*1.3),fill=INK,width=4)',
    'if any(k in p for k in ("skate","skateboard")):',
    ' d.ellipse((cx-S*1.3,cy+S*1.35,cx-S*0.7,cy+S*1.65),fill=INK); d.ellipse((cx+S*0.7,cy+S*1.35,cx+S*1.3,cy+S*1.65),fill=INK)',
    ' d.line((cx-S*1.5,cy+S*1.3,cx+S*1.5,cy+S*1.3),fill=CORAL,width=7)',
    'd.text((22,20),"MYN / RECYLA-01",fill=CREAM)',
    'label=prompt[:70]',
    'd.rectangle((8,h-38,min(w-8,22+len(label)*7),h-8),fill=CREAM)',
    'd.text((18,h-30),label,fill=INK)',
    'im.save(sys.argv[4],quality=88)',
  ].join('\n');
  await executar('python', ['-c', codigo, String(largura), String(altura), String(prompt).slice(0, 200), destino], { timeout: 60000 });
  return { nome, tipo: 'imagem', url: '/api/arquivos/' + encodeURIComponent(nome), prompt: String(prompt).slice(0, 600), fonte: 'Desenho local por palavra-chave · free, sem chave · sem rede' };
}

/** Pollinations primeiro; se a cota acabar, desenha localmente. */
export async function gerarImagem(prompt, largura = 768, altura = 512) {
  const texto = String(prompt || '').trim().slice(0, 600);
  if (!texto) throw new Error('prompt vazio');
  try {
    const url = 'https://image.pollinations.ai/prompt/' + encodeURIComponent(texto)
      + '?width=' + largura + '&height=' + altura + '&seed=' + Math.floor(Math.random() * 999999) + '&nologo=true';
    const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!r.ok) throw new Error('Pollinations HTTP ' + r.status);
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length < 5000) throw new Error('resposta vazia');
    const nome = await salvarArquivo('imagem-' + Date.now() + '.jpg', bytes);
    return { nome, tipo: 'imagem', url: '/api/arquivos/' + encodeURIComponent(nome), prompt: texto, fonte: 'Pollinations · free, sem chave · taxa comunitária' };
  } catch { return gerarImagemLocal(texto, largura, altura); }
}

export async function gerarAudio(texto, voz = 'pt-BR-FranciscaNeural') {
  const fala = String(texto || '').trim().slice(0, 1500);
  if (!fala) throw new Error('texto vazio');
  const nome = 'audio-' + Date.now() + '.mp3';
  const destino = path.join(DIR_ARQUIVOS, nome);
  const codigo = 'import asyncio,sys,edge_tts;asyncio.run(edge_tts.Communicate(sys.argv[1],sys.argv[2]).save(sys.argv[3]))';
  await executar('python', ['-c', codigo, fala, voz, destino], { timeout: 120000 });
  return { nome, tipo: 'audio', url: '/api/arquivos/' + encodeURIComponent(nome), texto: fala, voz, fonte: 'edge-tts · free, sem chave · ~1500 caracteres' };
}

export async function gerarVideo(prompt, segundos = 6) {
  const img = await gerarImagem(prompt, 960, 540);
  const nome = 'video-' + Date.now() + '.mp4';
  const destino = path.join(DIR_ARQUIVOS, nome);
  const origem = path.join(DIR_ARQUIVOS, img.nome);
  const dur = Math.min(15, Math.max(3, Number(segundos) || 6));
  const filtro = `scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0012,1.18)':d=${dur * 25}:s=1280x720:fps=25,format=yuv420p`;
  await executar('ffmpeg', ['-y', '-loop', '1', '-i', origem, '-vf', filtro, '-t', String(dur), '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-an', destino], { timeout: 180000 });
  return { nome, tipo: 'video', url: '/api/arquivos/' + encodeURIComponent(nome), imagem: img.url, prompt: String(prompt).slice(0, 600), duracao: dur, fonte: img.fonte + ' + ffmpeg local · limite = CPU' };
}

export function tipoMime(nome) {
  const ext = path.extname(nome).toLowerCase();
  return ({ '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.mp3':'audio/mpeg', '.wav':'audio/wav', '.mp4':'video/mp4', '.pdf':'application/pdf', '.csv':'text/csv', '.json':'application/json', '.txt':'text/plain', '.md':'text/markdown' })[ext] || 'application/octet-stream';
}
