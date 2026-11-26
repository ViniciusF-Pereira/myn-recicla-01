/** Fonte única de dados atuais para as telas. Todas as chamadas são same-origin e somente leitura. */
async function json(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(url + ' ' + r.status);
  return r.json();
}

function categoria(plugins, id) {
  return plugins.filter((p) => p.categoria === id);
}

export async function carregarDados() {
  const urls = {
    plugins: '/api/plugins', modelos: '/api/modelos', descobertos: '/api/modelos/descobertos',
    desempenho: '/api/desempenho', arquitetura: '/api/arquitetura', saude: '/api/saude',
    analise: '/api/worker-analise/status', melhoria: '/api/worker-melhoria/status', supervisor: '/api/supervisor/status',
  };
  const chaves = Object.keys(urls);
  const resultados = await Promise.allSettled(chaves.map((k) => json(urls[k])));
  const dados = { atualizadoEm: new Date().toISOString(), erros: [] };
  chaves.forEach((k, i) => {
    const r = resultados[i];
    if (r.status === 'fulfilled') dados[k] = r.value;
    else dados.erros.push({ fonte: k, erro: r.reason?.message || String(r.reason) });
  });
  const plugins = dados.plugins?.plugins || [];
  dados.pluginsLista = plugins;
  dados.totalPlugins = dados.plugins?.total ?? plugins.length;
  dados.categorias = Object.fromEntries(['chat', 'imagem', 'video', 'voz', 'agente', 'api', 'mensageria', 'pesquisa', 'utilidade']
    .map((id) => [id, categoria(plugins, id)]));
  dados.totalModelos = dados.modelos?.total ?? 0;
  dados.totalDescobertos = dados.descobertos?.total ?? 0;
  dados.porFonteModelos = dados.descobertos?.porFonte || {};
  dados.totalKb = dados.desempenho?.totalKb ?? null;
  dados.piorMs = dados.desempenho?.medidas?.length ? Math.max(...dados.desempenho.medidas.map((m) => m.p50Ms || 0)) : null;
  dados.arquiteturaResumo = dados.arquitetura?.resumo || null;
  const idsPlugins = new Set(plugins.map((p) => p.id));
  const saude = (dados.saude?.rotas || []).filter((r) => idsPlugins.has(r.id));
  dados.saudeMedia = saude.length ? saude.reduce((n, r) => n + (r.score || 0), 0) / saude.length : null;
  dados.workers = { analise: dados.analise || null, melhoria: dados.melhoria || null, supervisor: dados.supervisor || null };
  return dados;
}

export async function carregarEventos(worker = 'melhoria', limite = 30) {
  try { return (await json('/api/worker-' + worker + '/eventos?limite=' + limite)).eventos || []; }
  catch { return []; }
}

export function resumoWorkers(dados) {
  return Object.entries(dados.workers || {}).map(([nome, w]) => nome + ': ' + (w?.ativo ? 'ativo' : 'parado') + (w?.ciclos != null ? ' · ' + w.ciclos + ' ciclos' : '')).join(' | ');
}
