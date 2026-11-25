/** Propostas de engenharia por LLM free. O worker valida e mantém código em branch; nunca mergeia sozinho. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditarArquitetura } from './arquitetura.mjs';

const RAIZ = process.cwd();
const ENDPOINT = 'https://text.pollinations.ai/openai';
const MODELO = 'openai-fast';
let giro = 0;

const ALVOS = {
  codigo: ['src/stream.mjs', 'src/rag.mjs', 'src/loop.mjs', 'src/orquestrar-modelos.mjs', 'src/plugins.mjs'],
  infra: ['scripts/site-server.mjs'],
  modelos: ['src/modelos-livres.mjs'],
  arquitetura: ['src/engenheiro.mjs', 'src/arquitetura.mjs', 'src/worker-analise.mjs'],
};

function extrairJson(texto) {
  const limpo = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const ini = limpo.indexOf('{'), fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim <= ini) throw new Error('resposta sem JSON');
  return JSON.parse(limpo.slice(ini, fim + 1));
}

function validar(proposta, arquivo) {
  if (!/^(src|scripts|web)\//.test(arquivo) || arquivo.includes('..')) throw new Error('arquivo fora do escopo');
  if (!proposta.titulo || !proposta.motivo || !Array.isArray(proposta.substituicoes)) throw new Error('JSON incompleto');
  if (!proposta.substituicoes.length || proposta.substituicoes.length > 3) throw new Error('proposta deve ter 1 a 3 substituições');
  for (const s of proposta.substituicoes) {
    if (typeof s.antigo !== 'string' || !s.antigo.trim() || typeof s.novo !== 'string' || !s.novo.trim()) throw new Error('substituição inválida');
    if (s.antigo.length > 8000 || s.novo.length > 12000) throw new Error('patch grande demais');
  }
  return proposta;
}

export async function gerarProposta() {
  const categorias = Object.keys(ALVOS);
  const categoria = categorias[giro++ % categorias.length];
  const lista = ALVOS[categoria];
  let arquivo = lista[0], codigo = '';
  for (const candidato of lista) {
    try { codigo = await readFile(path.join(RAIZ, candidato), 'utf8'); arquivo = candidato; break; } catch { /* próximo */ }
  }
  if (!codigo) throw new Error('nenhum alvo legível');
  const prompt = `Você é engenheiro do projeto Myn Recicla/01 (Node ESM, browser-only, sem chaves, sem Google/Gemini).
Categoria desta rodada: ${categoria}.
Arquivo: ${arquivo}.

Proponha UMA melhoria real e específica. Pode corrigir bug, reduzir trabalho repetido, melhorar robustez, infra ou arquitetura.
É PROIBIDO: mudança só de estilo, comentário, documentação, renomear, helper sem uso, ou remover comportamento público.
Preserve exports e comportamento observável. Não invente APIs.

Responda SOMENTE JSON válido neste formato:
{"titulo":"curto","motivo":"problema concreto e beneficio","substituicoes":[{"antigo":"trecho EXATO do arquivo","novo":"trecho novo EXATO"}]}

Código (${codigo.length} caracteres):
${codigo.slice(0, 14000)}`;

  const resposta = await fetch(ENDPOINT, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODELO, messages: [{ role: 'user', content: prompt }], temperature: 0.1 }),
    signal: AbortSignal.timeout(90000),
  });
  if (!resposta.ok) throw new Error('Pollinations ' + resposta.status);
  const dados = await resposta.json();
  const texto = dados.choices?.[0]?.message?.content;
  const proposta = validar(extrairJson(texto), arquivo);
  return { arquivo, categoria, modelo: dados.model || MODELO, ...proposta };
}

export async function aplicarProposta(proposta) {
  const destino = path.join(RAIZ, proposta.arquivo);
  let codigo = await readFile(destino, 'utf8');
  const aplicadas = [];
  for (const s of proposta.substituicoes) {
    const primeiro = codigo.indexOf(s.antigo);
    if (primeiro < 0 || codigo.indexOf(s.antigo, primeiro + 1) >= 0) throw new Error('trecho antigo não é único/exato');
    codigo = codigo.slice(0, primeiro) + s.novo + codigo.slice(primeiro + s.antigo.length);
    aplicadas.push({ antes: s.antigo.length, depois: s.novo.length });
  }
  await writeFile(destino, codigo, 'utf8');
  return { arquivo: proposta.arquivo, substituicoes: aplicadas.length, deltaBytes: aplicadas.reduce((n, s) => n + s.depois - s.antes, 0) };
}
