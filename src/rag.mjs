/** RAG mínimo, sem dependências: índice local de notas/relatórios com TF-IDF e citação por arquivo. */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONTES = [
  path.join(RAIZ, 'docs'),
  path.join(RAIZ, 'README.md'),
  ...String(process.env.MYN_RAG_FONTES || '').split(path.delimiter).map((p) => p.trim()).filter(Boolean),
];
const PARAR = new Set('de da do e em um uma para com que no na os as ao a o se por ou como mais muito está são foi ser pelo pela pelos pelas deste desta deste do disto que qual quais onde quando quem cujo'.split(' '));
let indice = null;

function tokens(texto) {
  return String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((p) => p.length > 2 && !PARAR.has(p));
}
function pedacos(texto, tamanho = 1100) {
  const limpo = texto.replace(/\r/g, '').replace(/[ \t]+/g, ' ');
  const saida = [];
  for (let i = 0; i < limpo.length; i += tamanho - 150) saida.push(limpo.slice(i, i + tamanho));
  return saida.filter((p) => p.trim().length > 80);
}
async function arquivosDe(caminho, acc = []) {
  try {
    const s = await stat(caminho);
    if (s.isFile()) { if (/\.(md|txt|html)$/i.test(caminho) && s.size < 2_000_000) acc.push(caminho); return acc; }
    for (const e of await readdir(caminho, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === '_arquivo') continue;
      await arquivosDe(path.join(caminho, e.name), acc);
    }
  } catch { /* fonte indisponível */ }
  return acc;
}

export async function indexar(forcar = false) {
  if (indice && !forcar) return indice;
  const docs = [];
  for (const fonte of FONTES) for (const arquivo of await arquivosDe(fonte)) {
    const texto = await readFile(arquivo, 'utf8').catch(() => '');
    for (const pedaco of pedacos(texto)) docs.push({ fonte: path.relative(RAIZ, arquivo).replaceAll('\\', '/'), texto: pedaco, tf: contar(tokens(pedaco)) });
  }
  const df = new Map();
  for (const d of docs) for (const t of Object.keys(d.tf)) df.set(t, (df.get(t) || 0) + 1);
  indice = { docs, df, n: docs.length };
  return indice;
}
function contar(lista) { const m = {}; for (const t of lista) m[t] = (m[t] || 0) + 1; return m; }

export async function buscar(pergunta, k = 4) {
  const idx = await indexar();
  const q = contar(tokens(pergunta));
  const pontos = idx.docs.map((d) => {
    let score = 0;
    for (const [t, tf] of Object.entries(q)) {
      if (!d.tf[t]) continue;
      const idf = Math.log(1 + idx.n / (1 + (idx.df.get(t) || 0)));
      score += tf * (1 + Math.log(d.tf[t])) * idf;
    }
    return { ...d, score };
  }).filter((d) => d.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
  return pontos.map((p) => ({ fonte: p.fonte, trecho: p.texto.slice(0, 900), score: Number(p.score.toFixed(2)) }));
}

export async function contextoPara(pergunta, limite = 3500) {
  const achados = await buscar(pergunta, 4);
  let texto = '';
  for (const a of achados) {
    const bloco = `\n[FONTE: ${a.fonte}]\n${a.trecho}\n`;
    if (texto.length + bloco.length > limite) break;
    texto += bloco;
  }
  return { texto, fontes: achados.map((a) => a.fonte) };
}
export function contarTokens(s){return String(s||"").toLowerCase().split(/\W+/).filter(Boolean).length}
