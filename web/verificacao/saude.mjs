/** Scoreboard no cliente: 0,45*sucesso + 0,35*velocidade + 0,2*recência; circuito 3-estados. */
const CHAVE = 'myn-saude-v1';
let mapa;
function carregar() {
  if (mapa) return mapa;
  try { mapa = JSON.parse(localStorage.getItem(CHAVE) || '{}'); } catch { mapa = {}; }
  return mapa;
}
function salvar() { localStorage.setItem(CHAVE, JSON.stringify(mapa)); }
function vazio() { return { sucessos: 0, falhas: 0, ewma: null, circuito: 'closed', ate: 0, ultimo: 0 }; }
function obter(id) {
  const m = carregar();
  if (!m[id]) m[id] = vazio();
  const r = m[id];
  if (r.circuito === 'open' && Date.now() > r.ate) r.circuito = 'half_open';
  return r;
}
const NAO_CONTA = /content_policy|recusa|refus/i;
export function registrar(id, { ok, ms = 0, erro = '' }) {
  const r = obter(id);
  if (ok) {
    r.sucessos++; r.circuito = 'closed'; r.ate = 0; r.ultimo = Date.now();
    r.ewma = r.ewma === null ? ms : Math.round(r.ewma * 0.75 + ms * 0.25);
  } else if (!NAO_CONTA.test(erro)) {
    r.falhas++;
    if (/timeout/i.test(erro) || r.falhas >= 3) { r.circuito = 'open'; r.ate = Date.now() + 30000; }
  }
  salvar();
  return r;
}
export function pontuar(id) {
  const r = obter(id);
  const total = r.sucessos + r.falhas;
  const taxa = total ? r.sucessos / total : 0.5;
  const vel = r.ewma === null ? 0.5 : Math.max(0, 1 - r.ewma / 12000);
  const idade = r.ultimo ? Math.min(1, (Date.now() - r.ultimo) / 600000) : 1;
  return { id, score: Math.round((0.45 * taxa + 0.35 * vel + 0.2 * (1 - idade)) * 100) / 100, circuito: r.circuito };
}
export function relatorio() { return Object.keys(carregar()).map(pontuar).sort((a, b) => b.score - a.score); }
export function escolher(ids) {
  const pts = ids.map(pontuar).filter((p) => p.circuito !== 'open');
  return (pts.length ? pts : ids.map(pontuar)).sort((a, b) => b.score - a.score).map((p) => p.id);
}
