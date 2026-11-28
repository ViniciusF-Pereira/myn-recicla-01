/** Benchmark verificável do agente Myn; não finge comparação direta com ChatGPT. */
import { writeFile, mkdir } from 'node:fs/promises';
import { orientarPedido } from '../web/tools/orientador.mjs';

const base = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';

async function medirSSE(mensagem, pesquisa = false) {
  const inicio = performance.now();
  let primeiroTokenMs = null, texto = '', tipos = new Set(), fontes = 0, ferramentas = 0, erro = '';
  const params = new URLSearchParams({ message: mensagem, pesquisa: pesquisa ? '1' : '0', rota: 'auto', sessao: 'benchmark', effort: 'low' });
  const resposta = await fetch(base + '/api/chat/stream?' + params, { signal: AbortSignal.timeout(60000) });
  if (!resposta.ok || !resposta.body) throw new Error('HTTP ' + resposta.status);
  const leitor = resposta.body.getReader(), dec = new TextDecoder();
  let resto = '';
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    resto += dec.decode(value, { stream: true });
    const blocos = resto.split(/\n\n/); resto = blocos.pop() || '';
    for (const bloco of blocos) {
      const m = /^data:\s*(.+)$/m.exec(bloco);
      if (!m) continue;
      const ev = JSON.parse(m[1]);
      tipos.add(ev.type || (ev.token ? 'token' : ev.erro ? 'erro' : 'evento'));
      if (ev.token && primeiroTokenMs === null) primeiroTokenMs = Math.round(performance.now() - inicio);
      if (ev.token) texto += ev.token;
      if (ev.inicio) { fontes = ev.fontes?.length || 0; ferramentas = ev.ferramentas?.length || 0; }
      if (ev.erro) erro = ev.erro;
    }
  }
  return {
    mensagem, pesquisa, primeiroTokenMs, totalMs: Math.round(performance.now() - inicio),
    tipos: [...tipos], fontes, ferramentas, caracteres: texto.length, preview: texto.slice(0, 140), erro,
  };
}

const casosOrientacao = [
  ['gere uma planilha de alertas', 'planilha'],
  ['crie uma imagem editorial', 'imagem'],
  ['faça um vídeo de 6 segundos', 'video'],
  ['narrar este texto', 'audio'],
  ['pesquise fontes e compare rotas', 'pesquisa'],
  ['o que está na memória?', 'memoria'],
];
const orientacao = casosOrientacao.map(([texto, esperado]) => ({ texto, esperado, obtido: orientarPedido(texto).intencao, ok: orientarPedido(texto).intencao === esperado }));
const sse = [];
const repeticoes = 3;
for (const [mensagem, pesquisa] of [['Explique o Myn em uma frase.', false], ['Pesquise fontes sobre a extensão do Myn.', true]]) {
  for (let rodada = 1; rodada <= repeticoes; rodada++) {
    try { sse.push({ rodada, ...await medirSSE(mensagem, pesquisa) }); }
    catch (erro) { sse.push({ rodada, mensagem, pesquisa, erro: erro.message }); }
  }
}
function mediana(valores) {
  const ordenados = valores.filter(Number.isFinite).sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  return ordenados.length % 2 ? ordenados[meio] : Math.round((ordenados[meio - 1] + ordenados[meio]) / 2);
}
const resumo = [false, true].map((pesquisa) => {
  const casos = sse.filter((x) => x.pesquisa === pesquisa);
  const valores = casos.map((x) => x.primeiroTokenMs).filter(Number.isFinite);
  const medianaPrimeiro = mediana(valores);
  return {
    pesquisa,
    repeticoes: casos.length,
    primeiroTokenMs: { mediana: medianaPrimeiro, minimo: valores.length ? Math.min(...valores) : null, maximo: valores.length ? Math.max(...valores) : null },
    dentroMeta500ms: Number.isFinite(medianaPrimeiro) && medianaPrimeiro <= 500,
    totalMs: { mediana: mediana(casos.map((x) => x.totalMs)) },
    fontes: Math.max(...casos.map((x) => x.fontes || 0)),
    ferramentas: Math.max(...casos.map((x) => x.ferramentas || 0)),
  };
});
const eventosBase = ['response.created', 'response.in_progress', 'response.output_text.delta', 'response.completed'];
const verificacoes = sse.map((caso) => {
  const exigidos = caso.pesquisa ? [...eventosBase, 'tool.start', 'tool.end'] : eventosBase;
  const ausentes = exigidos.filter((tipo) => !caso.tipos?.includes(tipo));
  const falhas = [];
  if (caso.erro) falhas.push(caso.erro);
  if (ausentes.length) falhas.push('eventos ausentes: ' + ausentes.join(', '));
  if (!Number.isFinite(caso.primeiroTokenMs)) falhas.push('sem primeiro token');
  if (caso.pesquisa && !(caso.fontes > 0)) falhas.push('pesquisa sem fontes');
  return { rodada: caso.rodada, pesquisa: caso.pesquisa, ok: falhas.length === 0, falhas };
});
const relatorio = {
  geradoEm: new Date().toISOString(), base,
  objetivo: 'Myn melhor que um chat genérico em tool-use, artefatos, fontes, cancelamento e custo verificável.',
  limite: 'Sem acesso pago ao ChatGPT nesta execução; os resultados são do Myn e servem como baseline, não como paridade medida.',
  orientacao: { total: orientacao.length, aprovados: orientacao.filter((x) => x.ok).length, casos: orientacao },
  sse,
  resumo,
  verificacoes,
  aprovado: orientacao.every((x) => x.ok) && verificacoes.every((x) => x.ok) && resumo.every((x) => x.dentroMeta500ms),
  criterios: {
    primeiroTokenLocalMs: 500,
    eventosSemanticos: ['response.created', 'tool.start', 'tool.end', 'response.in_progress', 'response.output_text.delta', 'response.completed'],
    pesquisaComFontes: true,
    cancelamento: 'validado no navegador por outputs/qa-sse-widgets.mjs',
    custoPago: 0,
  },
};
await mkdir('outputs', { recursive: true });
await writeFile('outputs/benchmark-agente.json', JSON.stringify(relatorio, null, 2));
console.log(JSON.stringify(relatorio, null, 2));
if (orientacao.some((x) => !x.ok) || verificacoes.some((x) => !x.ok) || resumo.some((x) => !x.dentroMeta500ms)) process.exitCode = 1;
