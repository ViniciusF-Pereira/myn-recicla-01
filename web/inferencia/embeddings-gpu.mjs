/** Capacidade WebGPU no cliente. Lazy-load opcional de embeddings; degrada para TF-IDF. */
export function capacidade() {
  return { webgpu: Boolean(navigator.gpu), seguro: isSecureContext, modo: navigator.gpu && isSecureContext ? 'webgpu' : 'tfidf' };
}
let pipeline = null;
export async function embeddings(textos) {
  if (!navigator.gpu || !isSecureContext) return null;
  try {
    if (!pipeline) {
      const mod = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
      const extrator = await mod.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { device: 'webgpu', dtype: 'q8' });
      pipeline = extrator;
    }
    const out = await pipeline(textos, { pooling: 'mean', normalize: true });
    return Array.from(out.tolist ? out.tolist() : out.data);
  } catch { return null; }
}
export function similaridade(a, b) {
  let soma = 0, na = 0, nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) { soma += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return na && nb ? soma / Math.sqrt(na * nb) : 0;
}
