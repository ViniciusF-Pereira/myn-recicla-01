/** LLM no navegador via WebGPU (WebLLM). Fallback de ÚLTIMO recurso para recusa/falha de rota. */
let engine = null;
let carregando = null;
const MODELO = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

export function disponivel() {
  return Boolean(navigator.gpu && isSecureContext);
}

async function obter() {
  if (engine) return engine;
  if (carregando) return carregando;
  if (!disponivel()) throw new Error('WebGPU indisponível');
  carregando = (async () => {
    const { CreateMLCEngine } = await import('https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.80/+esm');
    const e = await CreateMLCEngine(MODELO, { initProgressCallback: () => {} });
    engine = e;
    return e;
  })().catch((e) => { carregando = null; throw e; });
  return carregando;
}

/** Responde localmente no WebGPU. Nunca gera imagem e nunca inventa fonte. */
export async function responder(prompt, onToken) {
  const e = await obter();
  const partes = [];
  const stream = await e.chat.completions.create({
    messages: [{ role: 'user', content: String(prompt).slice(0, 2500) }],
    temperature: 0.4,
    max_tokens: 400,
    stream: true,
  });
  for await (const chunk of stream) {
    const t = chunk?.choices?.[0]?.delta?.content || '';
    if (t) { partes.push(t); if (onToken) onToken(t); }
  }
  return partes.join('').trim();
}

export const info = { modelo: MODELO, via: 'webgpu-local' };
