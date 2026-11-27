/** Empacota a extensão em ZIP sem dependências externas. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origem = path.join(raiz, 'site', 'extensao');
const destino = path.join(origem, 'myn-recicla-extensao.zip');
const arquivos = ['manifest.json', 'background.js', 'content-script.js', 'rotas.js', 'painel.html', 'painel.css', 'painel.js', 'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'];

const tabela = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  tabela[n] = c >>> 0;
}
function crc32(buffer) {
  let c = 0xffffffff;
  for (const b of buffer) c = tabela[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosData() {
  const d = new Date();
  return { hora: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), data: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
function headerLocal(nome, dados, crc, hora, data) {
  const h = Buffer.alloc(30);
  h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6); h.writeUInt16LE(0, 8);
  h.writeUInt16LE(hora, 10); h.writeUInt16LE(data, 12); h.writeUInt32LE(crc, 14);
  h.writeUInt32LE(dados.length, 18); h.writeUInt32LE(dados.length, 22); h.writeUInt16LE(nome.length, 26); h.writeUInt16LE(0, 28);
  return Buffer.concat([h, Buffer.from(nome), dados]);
}
function headerCentral(nome, dados, crc, hora, data, offset) {
  const h = Buffer.alloc(46);
  h.writeUInt32LE(0x02014b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(20, 6); h.writeUInt16LE(0, 8); h.writeUInt16LE(0, 10);
  h.writeUInt16LE(hora, 12); h.writeUInt16LE(data, 14); h.writeUInt32LE(crc, 16);
  h.writeUInt32LE(dados.length, 20); h.writeUInt32LE(dados.length, 24); h.writeUInt16LE(nome.length, 28);
  h.writeUInt16LE(0, 30); h.writeUInt16LE(0, 32); h.writeUInt16LE(0, 34); h.writeUInt16LE(0, 36);
  h.writeUInt32LE(0, 38); h.writeUInt32LE(offset, 42);
  return Buffer.concat([h, Buffer.from(nome)]);
}

await mkdir(origem, { recursive: true });
const { hora, data } = dosData();
const locais = [], centrais = [];
let offset = 0;
for (const nome of arquivos) {
  const dados = await readFile(path.join(origem, nome));
  const crc = crc32(dados);
  const local = headerLocal(nome, dados, crc, hora, data);
  locais.push(local);
  centrais.push(headerCentral(nome, dados, crc, hora, data, offset));
  offset += local.length;
}
const central = Buffer.concat(centrais);
const fim = Buffer.alloc(22);
fim.writeUInt32LE(0x06054b50, 0); fim.writeUInt16LE(0, 4); fim.writeUInt16LE(0, 6);
fim.writeUInt16LE(arquivos.length, 8); fim.writeUInt16LE(arquivos.length, 10);
fim.writeUInt32LE(central.length, 12); fim.writeUInt32LE(offset, 16); fim.writeUInt16LE(0, 20);
await writeFile(destino, Buffer.concat([...locais, central, fim]));
console.log('Extensão empacotada em ' + destino);
