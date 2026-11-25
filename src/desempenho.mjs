/** Mede o site real no fio: bytes recebidos (com gzip), p50 e reaproveitamento via ETag/304. Somente leitura. */
import http from 'node:http';

export const ORCAMENTO = { paginaMs: 150, apiMs: 120, paginaKb: 120, apiKb: 120 };
const PAGINAS = ['/', '/playground.html', '/playground.js'];
const APIS = ['/api/plugins', '/api/modelos', '/api/saude'];

function requisitar(base, caminho, etag) {
  return new Promise((resolve) => {
    const u = new URL(caminho, base);
    const cabecalhos = { 'accept-encoding': 'gzip', connection: 'close' };
    if (etag) cabecalhos['if-none-match'] = etag;
    const t = performance.now();
    const req = http.get({ hostname: u.hostname, port: u.port || 80, path: u.pathname + u.search, headers: cabecalhos }, (res) => {
      let bytes = 0;
      res.on('data', (b) => { bytes += b.length; });
      res.on('end', () => resolve({
        ms: performance.now() - t, bytes, status: res.statusCode,
        etag: res.headers.etag || '', encoding: res.headers['content-encoding'] || 'identidade',
        cache: res.headers['cache-control'] || '',
      }));
    });
    req.on('error', (e) => resolve({ ms: performance.now() - t, bytes: 0, status: 0, etag: '', encoding: '', cache: '', erro: e.message }));
    req.setTimeout(5000, () => req.destroy(new Error('timeout')));
  });
}

export async function medirDesempenho(base = 'http://127.0.0.1:5188', amostras = 2) {
  const alvos = [...PAGINAS.map((alvo) => ({ alvo, tipo: 'pagina' })), ...APIS.map((alvo) => ({ alvo, tipo: 'api' }))];
  const medidas = [];
  for (const { alvo, tipo } of alvos) {
    const tempos = [], bytes = [];
    let status = 0, encoding = '', etag = '', cache = '', ms304 = null, erro = null;
    for (let i = 0; i < amostras; i++) {
      const a = await requisitar(base, alvo);
      tempos.push(a.ms); bytes.push(a.bytes);
      if (a.status) { status = a.status; encoding = a.encoding; etag = a.etag; cache = a.cache; erro = a.erro || null; }
      if (etag && i === 0) {
        const b = await requisitar(base, alvo, etag);
        if (b.status === 304) ms304 = Math.round(b.ms);
      }
    }
    const ts = [...tempos].sort((a, b) => a - b);
    const bs = [...bytes].sort((a, b) => a - b);
    const p50Ms = Math.round(ts[Math.floor(ts.length / 2)]);
    const kb = Math.round((bs[Math.floor(bs.length / 2)] / 1024) * 10) / 10;
    const limiteMs = tipo === 'api' ? ORCAMENTO.apiMs : ORCAMENTO.paginaMs;
    const limiteKb = tipo === 'api' ? ORCAMENTO.apiKb : ORCAMENTO.paginaKb;
    const ok = status === 200 && p50Ms <= limiteMs && kb <= limiteKb;
    medidas.push({ alvo, tipo, status, p50Ms, kb, limiteMs, limiteKb, encoding, etag: !!etag, revalidacao304: ms304, ok, erro });
  }
  return {
    quando: new Date().toISOString(), base, amostras,
    orcamento: ORCAMENTO, medidas,
    totalKb: Math.round(medidas.reduce((n, m) => n + m.kb, 0) * 10) / 10,
    gargalos: medidas.filter((m) => !m.ok).map((m) => m.alvo),
  };
}
