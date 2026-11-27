/** Rate limit, retry e circuit breaker em memória para rotas externas. */
const baldes = new Map();
const circuitos = new Map();

export function permitir(chave, { max = 30, janelaMs = 60_000 } = {}) {
  const agora = Date.now();
  const b = baldes.get(chave) || { inicio: agora, quantidade: 0 };
  if (agora - b.inicio >= janelaMs) { b.inicio = agora; b.quantidade = 0; }
  if (b.quantidade >= max) return false;
  b.quantidade++;
  baldes.set(chave, b);
  return true;
}

export async function executarComRetry(fn, { tentativas = 2, atrasoMs = 10_000, deveRepetir = () => true } = {}) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try { return await fn(i); }
    catch (e) {
      ultimoErro = e;
      if (i + 1 >= tentativas || !deveRepetir(e)) break;
      const retry = Number(e.retryAfterMs || e.retryAfter || 0) * (String(e.retryAfter || '').includes('.') ? 1000 : 1);
      await new Promise((r) => setTimeout(r, Math.max(atrasoMs, retry || 0)));
    }
  }
  throw ultimoErro;
}

export function circuitoAberto(chave) {
  const c = circuitos.get(chave);
  if (!c || c.estado === 'closed') return false;
  if (c.estado === 'open' && Date.now() >= c.abertoAte) { c.estado = 'half-open'; circuitos.set(chave, c); return false; }
  return c.estado === 'open';
}

export function registrarResultado(chave, ok) {
  const c = circuitos.get(chave) || { falhas: 0, sucessos: 0, estado: 'closed' };
  if (ok) { c.falhas = 0; c.sucessos++; if (c.estado === 'half-open') c.estado = 'closed'; }
  else {
    c.falhas++; c.sucessos = 0;
    if (c.falhas >= 3 || c.estado === 'half-open') { c.estado = 'open'; c.abertoAte = Date.now() + 60_000; }
  }
  circuitos.set(chave, c);
}

export function estadoConfiabilidade() {
  return {
    baldes: [...baldes].map(([chave, b]) => ({ chave, quantidade: b.quantidade, janelaMs: 60_000 })),
    circuitos: [...circuitos].map(([chave, c]) => ({ chave, ...c })),
  };
}
