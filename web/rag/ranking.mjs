/** Ranking híbrido local: TF-IDF lexical + assinatura vetorial + embedding opcional. */
const PARAR = new Set('de da do e em um uma para com que no na os as ao a o se por ou como mais muito esta são foi ser pelo pela pelos pelas deste desta dos das que qual quais onde quando quem cujo'.split(' '));

export function tokens(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !PARAR.has(t));
}

export function conjuntoTokens(texto) { return new Set(tokens(texto)); }

export function vetorHash(texto, dimensao = 256) {
  const v = new Float32Array(dimensao);
  for (const t of new Set(tokens(texto))) {
    let h = 2166136261;
    for (const c of t) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % dimensao] += 1;
  }
  return v;
}

export function similaridade(a, b) {
  if (!a?.length || !b?.length) return 0;
  let produto = 0, normaA = 0, normaB = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    produto += a[i] * b[i]; normaA += a[i] * a[i]; normaB += b[i] * b[i];
  }
  return normaA && normaB ? produto / (Math.sqrt(normaA) * Math.sqrt(normaB)) : 0;
}

export function scoreLexico(consulta, texto, idf = new Map()) {
  const q = tokens(consulta), doc = tokens(texto);
  if (!q.length || !doc.length) return 0;
  const tf = new Map();
  for (const t of doc) tf.set(t, (tf.get(t) || 0) + 1);
  return q.reduce((soma, t) => {
    const f = tf.get(t) || 0;
    if (!f) return soma;
    const peso = idf.get(t) ?? 1;
    return soma + (1 + Math.log(f)) * peso;
  }, 0);
}

export function idfDocumentos(documentos, consulta) {
  const termos = new Set(tokens(consulta));
  const idf = new Map();
  for (const t of termos) {
    const df = documentos.filter((d) => conjuntoTokens(d.texto).has(t)).length;
    idf.set(t, Math.log((documentos.length + 1) / (df + 1)) + 1);
  }
  return idf;
}

export function scoreHibrido(consulta, texto, { idf = new Map(), vetorConsulta = vetorHash(consulta), vetorDocumento = vetorHash(texto), vetorNeuralConsulta = null, vetorNeuralDocumento = null } = {}) {
  const lexical = scoreLexico(consulta, texto, idf);
  const vetorial = similaridade(vetorConsulta, vetorDocumento);
  const neural = vetorNeuralConsulta && vetorNeuralDocumento ? similaridade(vetorNeuralConsulta, vetorNeuralDocumento) : 0;
  const score = lexical * 2 + vetorial * 2 + neural * 3;
  return { lexical, vetorial, neural, score };
}

export function trechoRelevante(texto, consulta, tamanho = 420) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim();
  if (limpo.length <= tamanho) return limpo;
  const termos = tokens(consulta);
  const pos = termos.map((t) => limpo.toLowerCase().indexOf(t)).filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? 0;
  const inicio = Math.max(0, pos - Math.floor(tamanho / 3));
  return (inicio ? '…' : '') + limpo.slice(inicio, inicio + tamanho) + (inicio + tamanho < limpo.length ? '…' : '');
}

export function resumirExtrativo(texto, limite = 6) {
  const conteudo = String(texto || '').trim();
  if (!conteudo) return '';
  const frequencia = new Map();
  for (const t of tokens(conteudo)) frequencia.set(t, (frequencia.get(t) || 0) + 1);
  const frases = conteudo.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 25);
  return frases.map((frase, i) => {
    const ts = tokens(frase);
    const score = ts.reduce((n, t) => n + (frequencia.get(t) || 0), 0) / Math.sqrt(ts.length || 1);
    return { frase, score, i };
  }).sort((a, b) => b.score - a.score).slice(0, limite).sort((a, b) => a.i - b.i)
    .map((x) => '- ' + x.frase.slice(0, 400)).join('\n');
}
