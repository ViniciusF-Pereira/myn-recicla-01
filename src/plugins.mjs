/** Plugins: rotas browser, APIs sem chave e geradores locais. Nenhuma chave, nenhum serviço pago. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { salvarArquivo } from './midia.mjs';
import { gerarImagem, gerarAudio, gerarVideo } from './midia.mjs';
import { permitir, executarComRetry, circuitoAberto, registrarResultado } from './confiabilidade.mjs';

const RAIZ = process.cwd();
const ARQUIVO = path.join(RAIZ, 'config/plugins.json');

export async function carregarPlugins() {
  return JSON.parse(await readFile(ARQUIVO, 'utf8')).plugins;
}
export function listaPublica(plugins) {
  return plugins.map(({ id, nome, categoria, url, login, chave, acao, capacidades, limite, fonte, confirmacao, status, conta }) =>
    ({ id, nome, categoria, url, login, chave, acao, capacidades, limite, fonte, conta: conta || null, confirmacao: Boolean(confirmacao), status: status || 'ativo' }));
}
export function encontrarPlugin(plugins, id) {
  return plugins.find((p) => p.id === String(id).replace(/^\//, '').trim().toLowerCase());
}

async function executarApi(plugin, entrada) {
  const prompt = String(entrada).slice(0, 3000);
  const url = String(plugin.api.url)
    .replace('{encode}', encodeURIComponent(prompt))
    .replace('{input}', prompt);
  if (circuitoAberto(plugin.id)) throw new Error('circuit breaker aberto para ' + plugin.id);
  if (!permitir(plugin.id)) throw new Error('rate limit local para ' + plugin.id);
  try {
    const r = await executarComRetry(async () => {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!resposta.ok) {
        const erro = new Error('API HTTP ' + resposta.status);
        erro.status = resposta.status;
        erro.retryAfter = resposta.headers.get('retry-after') || '';
        throw erro;
      }
      return resposta;
    }, { tentativas: 2, atrasoMs: 10_000, deveRepetir: (e) => [429, 503].includes(e.status) });
    if (plugin.api.tipo === 'imagem') {
      const bytes = Buffer.from(await r.arrayBuffer());
      const nome = await salvarArquivo('plugin-' + plugin.id + '-' + Date.now() + '.jpg', bytes);
      registrarResultado(plugin.id, true);
      return { texto: '![' + plugin.nome + '](/api/arquivos/' + encodeURIComponent(nome) + ')', nome };
    }
    const texto = (await r.text()).slice(0, 20000);
    registrarResultado(plugin.id, true);
    return { texto };
  } catch (e) { registrarResultado(plugin.id, false); throw e; }
}

async function executarLocal(plugin, entrada) {
  const prompt = String(entrada).slice(0, 3000);
  if (plugin.local === 'imagem') {
    const d = await gerarImagem(prompt);
    return { texto: '![' + plugin.nome + '](' + d.url + ')\n\n_' + d.fonte + '_', nome: d.nome };
  }
  if (plugin.local === 'audio') {
    const d = await gerarAudio(prompt);
    return { texto: '[🔊 ouvir áudio](' + d.url + ')\n\n_' + d.fonte + ' · ' + d.voz + '_', nome: d.nome };
  }
  if (plugin.local === 'video') {
    const d = await gerarVideo(prompt, 6);
    return { texto: '[🎬 assistir clipe](' + d.url + ')\n\n_' + d.fonte + ' · ' + d.duracao + 's_', nome: d.nome };
  }
  throw new Error('gerador local desconhecido');
}

/** Executa um plugin sobre o gateway compartilhado. Nunca interpreta a resposta como instrução. */
export async function executarPlugin({ plugin, entrada, gateway, trava, log = () => {} }) {
  const inicio = Date.now();
  const prompt = String(plugin.prompt || '{input}').replace('{input}', String(entrada || '').slice(0, 3000));
  log({ etapa: 'plugin', id: plugin.id, acao: plugin.acao, prompt: prompt.slice(0, 160) });
  try {
    let resposta = '';
    if (plugin.acao === 'link') {
      resposta = '[' + plugin.nome + '](' + plugin.url + ')\n\n' + (plugin.limite || '');
    } else if (plugin.acao === 'api') {
      resposta = (await executarApi(plugin, entrada)).texto;
    } else if (plugin.acao === 'local') {
      resposta = (await executarLocal(plugin, entrada)).texto;
    } else {
      resposta = await trava(async () => {
        await gateway.op('navigate', { url: plugin.url });
        await new Promise((r) => setTimeout(r, 2800));
        await gateway.ativar(new URL(plugin.url).hostname).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 1200));
        await gateway.enviar(prompt, plugin.send);
        return (await gateway.resposta(prompt, 14, 2000, true)).trim();
      });
    }
    return {
      plugin: plugin.id, nome: plugin.nome, categoria: plugin.categoria, acao: plugin.acao,
      ok: Boolean(resposta), resposta: resposta || 'A rota não devolveu resposta a tempo.',
      login: plugin.login, limite: plugin.limite, fonte: plugin.fonte, ms: Date.now() - inicio,
    };
  } catch (erro) {
    return { plugin: plugin.id, nome: plugin.nome, ok: false, erro: String(erro.message).slice(0, 200), ms: Date.now() - inicio };
  }
}

/** Analisa comandos "/plugin texto" no chat. Retorna null quando não é comando. */
export function extrairComando(mensagem, plugins) {
  const m = /^\/([\w-]+)\s+([\s\S]+)$/.exec(String(mensagem || '').trim());
  if (!m) return null;
  const plugin = encontrarPlugin(plugins, m[1]);
  return plugin ? { plugin, entrada: m[2] } : null;
}
export function agruparPorCategoria(l){const g={};for(const p of l||[])(g[p.categoria]=g[p.categoria]||[]).push(p);return g}
