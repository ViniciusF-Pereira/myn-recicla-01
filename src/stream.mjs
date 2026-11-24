/** Resposta rápida e streaming via Pollinations Text API (SSE), sem chave. */
const MODELOS = ['openai', 'openai', 'gemini', 'deepseek', 'mistral'];

function valido(texto) {
  const s = String(texto || '').trim();
  if (s.length < 2 || s.length > 12000) return false;
  if (/budget|raise the key|service_unavailable|rate.?limit|too many requests|forbidden|unauthorized|invalid (api )?key/i.test(s)) return false;
  if (s.startsWith('{') && /"error"|"success"\s*:\s*false/.test(s)) return false;
  return true;
}

function urlTexto(pergunta, modelo) {
  return 'https://text.pollinations.ai/' + encodeURIComponent(pergunta) + '?model=' + modelo;
}
function urlStream(pergunta, modelo) {
  return urlTexto(pergunta, modelo) + '&stream=true';
}

async function tentar(modelo, pergunta, ms) {
  const r = await fetch(urlTexto(pergunta, modelo), { signal: AbortSignal.timeout(ms) });
  const texto = await r.text();
  if (!r.ok || !valido(texto)) throw new Error('modelo ' + modelo + ' indisponível');
  return { texto: texto.trim(), via: 'pollinations:' + modelo };
}

/** Dispara todos os modelos em paralelo e pega o primeiro válido. */
export async function respostaRapida(mensagem, prazoMs = 9000) {
  const pergunta = String(mensagem || '').slice(0, 4000);
  const inicio = Date.now();
  try {
    const r = await Promise.any(MODELOS.map((m) => tentar(m, pergunta, prazoMs)));
    return { ok: true, ...r, ms: Date.now() - inicio };
  } catch {
    return { ok: false, erro: 'APIs rápidas indisponíveis', ms: Date.now() - inicio };
  }
}

/** Gera tokens incrementalmente. Fallback: texto completo em pedaços. */
export async function* streamResposta(mensagem, prazoMs = 30000, fallbackTexto = '') {
  const pergunta = String(mensagem || '').slice(0, 4000);
  const inicio = Date.now();
  for (const modelo of MODELOS.slice(0, 3)) {
    let emitiu = false;
    try {
      const r = await fetch(urlStream(pergunta, modelo), { signal: AbortSignal.timeout(Math.max(4000, prazoMs - (Date.now() - inicio))) });
      if (!r.ok || !r.body) throw new Error('stream HTTP ' + r.status);
      const leitor = r.body.getReader();
      const decod = new TextDecoder();
      let resto = '', texto = '';
      while (Date.now() - inicio < prazoMs) {
        const { done, value } = await leitor.read();
        if (done) break;
        resto += decod.decode(value, { stream: true });
        const linhas = resto.split(/\r?\n/);
        resto = linhas.pop() || '';
        for (const linha of linhas) {
          if (!linha.startsWith('data:')) continue;
          const dados = linha.slice(5).trim();
          if (!dados || dados === '[DONE]') continue;
          try {
            const obj = JSON.parse(dados);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (delta) {
              if (!valido(texto + delta) && texto.length === 0 && /budget|unavailable|rate.?limit/i.test(delta)) throw new Error('erro no stream');
              texto += delta; emitiu = true;
              yield { token: delta, via: 'stream:' + modelo };
            }
          } catch (e) { if (String(e.message).includes('stream')) throw e; /* dado parcial, ignora */ }
        }
      }
      try { await leitor.cancel(); } catch { /* já fechou */ }
      if (emitiu && valido(texto)) { yield { done: true, via: 'stream:' + modelo, texto }; return; }
      if (emitiu) { yield { done: true, via: 'stream:' + modelo, texto }; return; }
    } catch { /* próximo modelo */ }
  }
  const rapida = await respostaRapida(pergunta, 7000);
  const texto = rapida.ok ? rapida.texto : (fallbackTexto || 'Não consegui responder agora. Tente novamente em instantes.');
  for (let i = 0; i < texto.length; i += 24) yield { token: texto.slice(i, i + 24), via: rapida.via || 'fallback' };
  yield { done: true, via: rapida.via || 'fallback', texto };
}
