/** Saúde dos adaptadores da extensão. Funções puras e testáveis. */
const AGORA = () => Date.now();
function tempo(agora) { return typeof agora === 'function' ? agora() : Number.isFinite(Number(agora)) ? Number(agora) : Date.now(); }
export function vazio() { return { sucessos: 0, falhas: 0, estado: 'closed', abertoAte: 0, ultimoErro: '', ultimaLatenciaMs: 0, ultimoUso: 0 }; }
export function registrarResultado(atual, { ok, ms = 0, erro = '' }, agora = AGORA) {
  const r = { ...vazio(), ...(atual || {}) }, t = tempo(agora);
  r.ultimoUso = t; r.ultimaLatenciaMs = ms;
  if (ok) { r.sucessos++; r.falhas = 0; r.estado = 'closed'; r.abertoAte = 0; r.ultimoErro = ''; }
  else { r.falhas++; r.ultimoErro = String(erro).slice(0, 300); if (r.falhas >= 3 || r.estado === 'half-open') { r.estado = 'open'; r.abertoAte = t + 60000; } }
  return r;
}
export function pontuar(id, atual = {}, agora = AGORA) {
  const r = { ...vazio(), ...(atual || {}) }, t = tempo(agora);
  if (r.estado === 'open' && t >= r.abertoAte) r.estado = 'half-open';
  const total = r.sucessos + r.falhas;
  const taxa = total ? r.sucessos / total : .5;
  const velocidade = r.ultimaLatenciaMs ? Math.max(0, 1 - r.ultimaLatenciaMs / 90000) : .5;
  const score = Math.round((.45 * taxa + .35 * velocidade + .2 * (r.estado === 'open' ? 0 : 1)) * 100) / 100;
  return { id, ...r, score };
}
export function ordenar(rotas, saude = {}, agora = AGORA) {
  return [...rotas].sort((a, b) => pontuar(b.id, saude[b.id], tempo(agora)).score - pontuar(a.id, saude[a.id], tempo(agora)).score);
}
