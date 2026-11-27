/** Seleção e execução de rotas com afinidade por conversa e fallback entre modelos/navegadores. */
import { escolherPara } from './orquestrar-modelos.mjs';
import { executarPlugin } from './plugins.mjs';
import { streamResposta } from './stream.mjs';
import { preferencias, salvarPreferencia } from './memoria.mjs';

function rotaValida(rota, plugins) {
  const plugin = plugins.find((p) => p.id === rota.id);
  return plugin && !plugin.confirmacao && !/google|gemini/i.test(plugin.id + ' ' + plugin.nome);
}

export async function selecionarRotas({ texto, sessao = 'local', plugins = [], max = 5 }) {
  const preferida = (await preferencias(sessao)).rota;
  const limite = Math.max(1, Math.min(10, Number(max) || 5));
  // Busca a lista completa antes de aplicar o limite: a rota fixa da conversa
  // precisa continuar elegível mesmo quando não for a primeira do scoreboard.
  let rotas = await escolherPara(texto, 100, false);
  rotas = rotas.filter((r) => rotaValida(r, plugins));
  // APIs primeiro; navegadores ficam como fallback quando a rota fixa falha.
  rotas.sort((a, b) => {
    const pa = plugins.find((p) => p.id === a.id)?.acao === 'api' ? 0 : 1;
    const pb = plugins.find((p) => p.id === b.id)?.acao === 'api' ? 0 : 1;
    return pa - pb;
  });
  if (preferida) {
    const i = rotas.findIndex((r) => r.id === preferida);
    if (i >= 0) rotas.unshift(...rotas.splice(i, 1));
  }
  return rotas.slice(0, limite);
}

export async function executarConversa({ texto, sessao = 'local', plugins = [], gateway, trava, maxRotas = 5 }) {
  const rotas = await selecionarRotas({ texto, sessao, plugins, max: maxRotas });
  const erros = [];
  for (const rota of rotas) {
    const plugin = plugins.find((p) => p.id === rota.id);
    try {
      const d = await executarPlugin({ plugin, entrada: texto, gateway, trava });
      if (d.ok && String(d.resposta || '').trim()) {
        await salvarPreferencia('rota', rota.id, sessao);
        return { ok: true, texto: d.resposta, via: rota.id, rota: rota.id, tentativas: erros.length + 1 };
      }
      erros.push(rota.id + ': ' + (d.erro || 'sem resposta'));
    } catch (e) { erros.push(rota.id + ': ' + e.message); }
  }
  await salvarPreferencia('rota', '', sessao);
  return { ok: false, erro: erros.join(' | ') || 'nenhuma rota disponível', erros };
}

export async function* streamConversa({ texto, sessao = 'local', plugins = [], gateway, trava, maxRotas = 5 }) {
  const rotas = await selecionarRotas({ texto, sessao, plugins, max: maxRotas });
  const erros = [];
  let tentativas = 0;
  for (const rota of rotas) {
    tentativas++;
    const plugin = plugins.find((p) => p.id === rota.id);
    try {
      if (rota.id === 'pollinations-text-api') {
        let textoFinal = '', via = '';
        for await (const ev of streamResposta(texto, 30000, '')) {
          if (ev.token) textoFinal += ev.token;
          if (ev.via) via = ev.via;
          if (ev.done && ev.texto) textoFinal = ev.texto;
          yield ev;
        }
        if (textoFinal.trim()) { await salvarPreferencia('rota', rota.id, sessao); yield { done: true, texto: textoFinal, via: via || rota.id, tentativas }; return; }
      } else {
        const d = await executarPlugin({ plugin, entrada: texto, gateway, trava });
        if (d.ok && String(d.resposta || '').trim()) {
          await salvarPreferencia('rota', rota.id, sessao);
          for (let i = 0; i < d.resposta.length; i += 48) yield { token: d.resposta.slice(i, i + 48), via: rota.id };
          yield { done: true, texto: d.resposta, via: rota.id, tentativas };
          return;
        }
        erros.push(rota.id + ': ' + (d.erro || 'sem resposta'));
      }
    } catch (e) { erros.push(rota.id + ': ' + e.message); }
  }
  await salvarPreferencia('rota', '', sessao);
  throw new Error(erros.join(' | ') || 'nenhuma rota disponível');
}
