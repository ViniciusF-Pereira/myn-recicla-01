/** Scoreboard de rotas: circuit breaker 3-estados + score por sucesso, latência EWMA e recência. */
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const ARQ = process.env.MYN_SAUDE || path.join(process.env.MYN_DADOS || path.join(process.cwd(), 'dados'), 'saude.json');
const LIMITE = 60;
const FALHAS_PARA_ABRIR = 3;
const COOLDOWN_MS = 30_000;

let mapa = new Map();
try {
  const salvo = JSON.parse(await readFile(ARQ, 'utf8'));
  mapa = new Map(Object.entries(salvo));
} catch { /* estado novo */ }

function vazio() {
  return { sucessos: 0, falhas: 0, consecutivas: 0, ewma: null, circuito: 'closed', ate: 0, ultimoSucesso: 0, ultimaFalha: 0, tipo: null };
}
function obter(id) {
  if (!mapa.has(id)) mapa.set(id, vazio());
  const r = mapa.get(id);
  if (r.circuito === 'open' && Date.now() > r.ate) r.circuito = 'half_open';
  return r;
}
async function salvar() {
  await writeFile(ARQ, JSON.stringify(Object.fromEntries(mapa), null, 2)).catch(() => {});
}

/** Falhas de conteúdo não derrubam a rota — o gerador local já cobre. */
const NAO_CONTA = /content_policy|recusa|refus/i;

export function registrar(id, { ok, ms = 0, erro = '' }) {
  const r = obter(id);
  if (ok) {
    r.sucessos++; r.consecutivas = 0; r.circuito = 'closed'; r.ate = 0;
    r.ultimoSucesso = Date.now();
    r.ewma = r.ewma === null ? ms : Math.round(r.ewma * 0.75 + ms * 0.25);
  } else {
    if (NAO_CONTA.test(erro)) { r.tipo = 'content_policy'; return salvar(); }
    r.falhas++; r.consecutivas++; r.ultimaFalha = Date.now(); r.tipo = String(erro).slice(0, 80);
    if (/timeout/i.test(erro) || r.consecutivas >= FALHAS_PARA_ABRIR) {
      r.circuito = 'open'; r.ate = Date.now() + COOLDOWN_MS;
    }
  }
  salvar();
  return r;
}

export function pontuar(id) {
  const r = obter(id);
  const total = r.sucessos + r.falhas;
  const taxa = total ? r.sucessos / total : 0.5;
  const vel = r.ewma === null ? 0.5 : Math.max(0, 1 - r.ewma / 12000);
  const idade = r.ultimoSucesso ? Math.min(1, (Date.now() - r.ultimoSucesso) / 600000) : 1;
  const score = Math.round((0.45 * taxa + 0.35 * vel + 0.2 * (1 - idade)) * 100) / 100;
  return { id, score, circuito: r.circuito, sucessos: r.sucessos, falhas: r.falhas, ewmaMs: r.ewma, tipo: r.tipo };
}

/** Ordena candidatas por saúde; circuitos abertos só voltam na sonda half-open. */
export function escolherRotas(ids) {
  const pontos = ids.map(pontuar);
  const elegiveis = pontos.filter((p) => p.circuito !== 'open');
  const lista = (elegiveis.length ? elegiveis : pontos.filter((p) => p.circuito === 'half_open'));
  return lista.sort((a, b) => b.score - a.score).map((p) => p.id);
}

export function relatorio() {
  return [...mapa.keys()].map(pontuar).sort((a, b) => b.score - a.score).slice(0, LIMITE);
}
export function mediaSaude(){const r=relatorio();return r.length?Math.round(r.reduce((n,x)=>n+x.score,0)/r.length*100)/100:0}
