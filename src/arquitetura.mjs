/** Auditoria real de arquitetura: grafo de imports, ciclos e direção das dependências. Somente leitura. */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = process.cwd();

async function arquivos(dir, prefix = dir) {
  const out = [];
  try {
    for (const e of await readdir(path.join(RAIZ, dir), { withFileTypes: true })) {
      const rel = path.posix.join(prefix.replace(/\\/g, '/'), e.name);
      if (e.isDirectory()) out.push(...await arquivos(rel));
      else if (/\.(mjs|js)$/.test(e.name)) out.push(rel);
    }
  } catch { /* diretório ausente */ }
  return out;
}

function camada(arquivo) {
  if (arquivo.startsWith('web/')) return 'apresentacao';
  if (arquivo.startsWith('scripts/')) return 'ferramentas';
  if (arquivo.startsWith('src/')) return 'nucleo';
  return 'outro';
}

function resolver(origem, especificador) {
  if (!especificador.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(origem), especificador));
  return /\.(mjs|js)$/.test(base) ? base : base + '.mjs';
}

function ciclos(grafo) {
  const cor = new Map(), pilha = [], achados = [];
  function dfs(no) {
    cor.set(no, 1); pilha.push(no);
    for (const vizinho of grafo.get(no) || []) {
      if (!grafo.has(vizinho)) continue;
      if (!cor.get(vizinho)) dfs(vizinho);
      else if (cor.get(vizinho) === 1) {
        const i = pilha.lastIndexOf(vizinho);
        achados.push(pilha.slice(i).concat(vizinho));
      }
    }
    pilha.pop(); cor.set(no, 2);
  }
  for (const no of grafo.keys()) if (!cor.get(no)) dfs(no);
  return achados;
}

export async function auditarArquitetura() {
  const lista = [...await arquivos('src'), ...await arquivos('web'), ...await arquivos('scripts')];
  const conjunto = new Set(lista), grafo = new Map(), violacoes = [], naoResolvidos = [], detalhes = [];
  for (const arquivo of lista) {
    const texto = await readFile(path.join(RAIZ, arquivo), 'utf8');
    const deps = new Set();
    for (const m of texto.matchAll(/(?:from\s+|import\s*\(\s*)['"](\.[^'"]+)['"]/g)) {
      const alvo = resolver(arquivo, m[1]);
      if (!alvo) continue;
      if (conjunto.has(alvo)) deps.add(alvo);
      else naoResolvidos.push({ origem: arquivo, import: m[1], alvo });
    }
    grafo.set(arquivo, [...deps]);
    const info = await stat(path.join(RAIZ, arquivo));
    const linhas = texto.split(/\r?\n/).length;
    detalhes.push({ arquivo, camada: camada(arquivo), linhas, dependencias: deps.size });
    for (const alvo of deps) {
      if (camada(arquivo) === 'nucleo' && camada(alvo) !== 'nucleo') {
        violacoes.push({ tipo: 'dependencia_invertida', origem: arquivo, alvo });
      }
    }
  }
  const encontrados = ciclos(grafo);
  for (const c of encontrados) violacoes.push({ tipo: 'ciclo', caminho: c });
  return {
    quando: new Date().toISOString(),
    resumo: {
      modulos: lista.length,
      dependencias: [...grafo.values()].reduce((n, d) => n + d.length, 0),
      ciclos: encontrados.length,
      violacoes: violacoes.length,
      importsNaoResolvidos: naoResolvidos.length,
    },
    violacoes, importsNaoResolvidos: naoResolvidos,
    detalhes: detalhes.sort((a, b) => b.linhas - a.linhas),
  };
}
