/** Resposta rápida sem chave: Pollinations Text API. Primeiro modelo válido vence. */
import { MODELOS_POLLINATIONS } from './modelos-pollinations.mjs';
const MODELOS = MODELOS_POLLINATIONS;
// Sem prompt de sistema: instruções vazam na resposta do Pollinations.
const SISTEMA = '';

function valido(texto) {
  const s = String(texto || '').trim();
  if (s.length < 2 || s.length > 12000) return false;
  if (/budget|raise the key|service_unavailable|rate.?limit|too many requests|forbidden|unauthorized|invalid (api )?key/i.test(s)) return false;
  if (s.startsWith('{') && /"error"|"success"\s*:\s*false/.test(s)) return false;
  return true;
}

async function tentar(modelo, pergunta, ms) {
  const url = 'https://text.pollinations.ai/' + encodeURIComponent(SISTEMA + pergunta) + '?model=' + modelo;
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  const texto = await r.text();
  if (!r.ok || !valido(texto)) throw new Error('modelo ' + modelo + ' indisponível');
  return texto.trim();
}

/** Tenta o modelo principal; se falhar, dispara os outros em paralelo e pega o primeiro válido. */
export async function respostaRapida(mensagem, prazoMs = 8000) {
  const pergunta = String(mensagem || '').slice(0, 4000);
  const inicio = Date.now();
  const restante = () => Math.max(800, prazoMs - (Date.now() - inicio));
  try {
    const texto = await tentar(MODELOS[0], pergunta, restante());
    return { ok: true, texto, via: 'pollinations:' + MODELOS[0], ms: Date.now() - inicio };
  } catch { /* cai no paralelo */ }
  try {
    const texto = await Promise.any(MODELOS.slice(1).map((m) => tentar(m, pergunta, restante())));
    return { ok: true, texto, via: 'pollinations:' + 'parallel', ms: Date.now() - inicio };
  } catch {
    return { ok: false, erro: 'APIs rápidas indisponíveis', ms: Date.now() - inicio };
  }
}
