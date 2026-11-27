/** Gera ícones PNG da extensão sem dependências externas. */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(RAIZ, 'site', 'extensao', 'icons');
const SS = 4;

const tabela = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  tabela[n] = c >>> 0;
}
function crc32(b) { let c = 0xffffffff; for (const x of b) c = tabela[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(tipo, dados) {
  const nome = Buffer.from(tipo);
  const out = Buffer.alloc(12 + dados.length);
  out.writeUInt32LE(dados.length, 0); nome.copy(out, 4); dados.copy(out, 8);
  out.writeUInt32LE(crc32(Buffer.concat([nome, dados])), 8 + dados.length);
  return out;
}
function rgba(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
}
function desenhar(tamanho) {
  const n = tamanho * SS;
  const px = Buffer.alloc(n * n * 4);
  const col = (x, y, c) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const i = (y * n + x) * 4; px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  };
  const azul = rgba('#1f6fe0'), azul2 = rgba('#0d4fa5'), tinta = rgba('#1b2430'), papel = rgba('#f4efe3'), branco = rgba('#ffffff'), mostarda = rgba('#d79a2f');
  const circulo = (cx, cy, r, c) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) col(x, y, c); };
  const anel = (cx, cy, r, esp, c) => { for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) { const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2); if (d <= r && d >= r - esp) col(x, y, c); } };
  const linha = (x0, y0, x1, y1, esp, c) => { const passos = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= passos; i++) { const x = Math.round(x0 + (x1 - x0) * i / passos), y = Math.round(y0 + (y1 - y0) * i / passos); circulo(x, y, esp / 2, c); } };
  const centro = n / 2;
  circulo(centro, centro, n * .47, tinta);
  circulo(centro, centro, n * .43, azul);
  circulo(centro, centro, n * .30, papel);
  anel(centro, centro, n * .30, n * .035, tinta);
  circulo(centro, centro, n * .14, azul2);
  circulo(centro, centro, n * .075, tinta);
  circulo(centro - n * .035, centro - n * .04, n * .028, branco);
  linha(centro - n * .12, centro - n * .31, centro + n * .12, centro - n * .31, n * .035, mostarda);
  circulo(centro, centro - n * .31, n * .035, mostarda);

  const saida = Buffer.alloc(tamanho * tamanho * 4);
  for (let y = 0; y < tamanho; y++) for (let x = 0; x < tamanho; x++) {
    const acc = [0, 0, 0, 0];
    for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
      const i = (((y * SS + sy) * n) + x * SS + sx) * 4;
      for (let k = 0; k < 4; k++) acc[k] += px[i + k];
    }
    const j = (y * tamanho + x) * 4;
    for (let k = 0; k < 4; k++) saida[j + k] = Math.round(acc[k] / (SS * SS));
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(tamanho, 0); ihdr.writeUInt32BE(tamanho, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(saida)), chunk('IEND', Buffer.alloc(0))]);
}

await mkdir(DIR, { recursive: true });
for (const n of [16, 32, 48, 128]) await writeFile(path.join(DIR, 'icon' + n + '.png'), desenhar(n));
console.log('Ícones gerados em ' + DIR);
