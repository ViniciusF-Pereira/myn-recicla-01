/** Descoberta de modelos por endpoints públicos, sem chave e sem Google/Gemini. */
const FONTES = {
  pollinations: 'https://text.pollinations.ai/models',
  openrouter: 'https://openrouter.ai/api/v1/models',
  huggingface: 'https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=40&full=true',
};

async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r.json();
}

function normalizarPollinations(lista) {
  return (lista || []).map((m) => ({
    fonte: 'pollinations', id: m.name, nome: m.name,
    descricao: m.description || '', contexto: m.context_length || null,
    modalidades: [...new Set([...(m.input_modalities || []), ...(m.output_modalities || [])])],
    gratuito: true, tier: m.tier || 'anonymous',
  }));
}

export function normalizarOpenRouter(dados) {
  return (dados?.data || [])
    .filter((m) => {
      const gratuito = String(m.id).endsWith(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0');
      const naoGoogle = !/google|gemini/i.test(String(m.id) + ' ' + String(m.name));
      return gratuito && naoGoogle;
    })
    .map((m) => ({
      fonte: 'openrouter', id: m.id, nome: m.name || m.id,
      descricao: m.description || '', contexto: m.context_length || null,
      modalidades: m.architecture?.input_modalities || [], gratuito: true,
      preco: { prompt: m.pricing?.prompt, completion: m.pricing?.completion },
    }));
}

function normalizarHuggingFace(lista) {
  return (lista || [])
    .filter((m) => !m.gated && ['text-generation', 'image-text-to-text'].includes(m.pipeline_tag))
    .map((m) => ({
      fonte: 'huggingface', id: m.id || m.modelId, nome: m.id || m.modelId,
      descricao: '', contexto: m.safetensors?.total || null,
      modalidades: m.pipeline_tag === 'image-text-to-text' ? ['text', 'image'] : ['text'],
      gratuito: 'endpoint publico; uso sujeito ao provedor', downloads: m.downloads || 0, likes: m.likes || 0,
    }));
}

export async function descobrirModelos() {
  const resultados = await Promise.allSettled(Object.entries(FONTES).map(async ([fonte, url]) => [fonte, await json(url)]));
  const modelos = [], erros = [];
  for (const [i, r] of resultados.entries()) {
    const fonte = Object.keys(FONTES)[i];
    if (r.status === 'fulfilled') {
      try {
        const lista = fonte === 'pollinations' ? normalizarPollinations(r.value[1])
          : fonte === 'openrouter' ? normalizarOpenRouter(r.value[1])
          : normalizarHuggingFace(r.value[1]);
        modelos.push(...lista);
      } catch (e) { erros.push({ fonte, erro: e.message }); }
    } else erros.push({ fonte, erro: String(r.reason?.message || r.reason).slice(0, 180) });
  }
  const unicos = [...new Map(modelos.map((m) => [m.fonte + ':' + m.id, m])).values()];
  return {
    atualizadoEm: new Date().toISOString(),
    total: unicos.length,
    porFonte: unicos.reduce((acc, m) => ({ ...acc, [m.fonte]: (acc[m.fonte] || 0) + 1 }), {}),
    erros, modelos: unicos,
  };
}

let cache = { em: 0, dados: null };
export async function obterModelos({ forcar = false, ttlMs = 60 * 60 * 1000 } = {}) {
  if (!cache.dados || forcar || Date.now() - cache.em > ttlMs) {
    cache = { em: Date.now(), dados: await descobrirModelos() };
  }
  return cache.dados;
}
