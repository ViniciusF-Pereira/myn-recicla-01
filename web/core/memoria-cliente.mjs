/** Memória local por sessão/projeto/global, com busca híbrida e resumo persistido. */
import * as db from '../db/leve.mjs';
import { vetorHash, scoreHibrido, idfDocumentos, resumirExtrativo } from '../rag/ranking.mjs';

function combina(item, { sessao, projeto, escopo }) {
  if (item.tipo !== 'memoria') return false;
  if (escopo === 'global') return true;
  if (escopo === 'projeto') return Boolean(projeto) && item.projeto === projeto;
  return Boolean(sessao) && item.sessao === sessao;
}

export function criarMemoria(repo) {
  async function registrar({ sessao = 'local', projeto = '', escopo = 'sessao', papel = 'usuario', texto, meta = {}, id } = {}) {
    if (!texto) return null;
    const item = { id: id || 'mem:' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 10), tipo: 'memoria', sessao: String(sessao), projeto: String(projeto), escopo, papel, texto: String(texto).slice(0, 12000), meta, t: Date.now() };
    await repo.inserir('eventos', item);
    return item;
  }

  async function contexto({ sessao, projeto, escopo = 'sessao', limite = 8 } = {}) {
    const todos = await repo.listar('eventos', 1000);
    return todos.filter((r) => combina(r, { sessao, projeto, escopo }) && !['preferencia', 'resumo'].includes(r.papel)).slice(-limite);
  }

  async function buscar(consulta, { sessao, projeto, escopo = 'sessao', limite = 6 } = {}) {
    const todos = (await repo.listar('eventos', 2000)).filter((r) => combina(r, { sessao, projeto, escopo }) && !['preferencia', 'resumo'].includes(r.papel));
    const idf = idfDocumentos(todos, consulta);
    const vq = vetorHash(consulta);
    return todos.map((r) => {
      const ranking = scoreHibrido(consulta, r.texto, { idf, vetorConsulta: vq });
      return { ...r, score: ranking.score, lexical: ranking.lexical, vetorial: ranking.vetorial };
    }).filter((r) => r.score > 0.15).sort((a, b) => b.score - a.score || b.t - a.t).slice(0, limite);
  }

  async function resumir({ sessao, projeto, escopo = 'sessao', limite = 6, persistir = false } = {}) {
    const ctx = await contexto({ sessao, projeto, escopo, limite: 40 });
    if (!ctx.length) return '';
    const resumo = resumirExtrativo(ctx.map((r) => r.texto).join(' '), limite);
    if (resumo && persistir) {
      const dono = sessao || projeto || 'global';
      await registrar({ sessao, projeto, escopo, papel: 'resumo', texto: resumo, id: 'resumo:' + escopo + ':' + dono, meta: { gerado: true } });
    }
    return resumo;
  }

  async function preferencia(chave, { sessao, projeto, escopo = 'sessao' } = {}) {
    const dono = sessao || projeto || 'global';
    const item = await repo.obter('sessoes', 'pref:' + escopo + ':' + dono);
    return item?.preferencias?.[chave] ?? null;
  }
  async function salvarPreferencia(chave, valor, { sessao, projeto, escopo = 'sessao' } = {}) {
    const dono = sessao || projeto || 'global', id = 'pref:' + escopo + ':' + dono;
    const atual = await repo.obter('sessoes', id);
    await repo.inserir('sessoes', { ...(atual || {}), id, tipo: 'preferencia', sessao, projeto, escopo, preferencias: { ...(atual?.preferencias || {}), [chave]: valor }, t: Date.now() });
    return valor;
  }
  async function preferencias({ sessao, projeto, escopo = 'sessao' } = {}) {
    const dono = sessao || projeto || 'global';
    return (await repo.obter('sessoes', 'pref:' + escopo + ':' + dono))?.preferencias || {};
  }

  async function exportar({ sessao, projeto, escopo = 'sessao' } = {}) {
    const todos = await repo.listar('eventos', 10000);
    return { _myn: 'myn-memoria', _versao: 1, eventos: todos.filter((r) => combina(r, { sessao, projeto, escopo })), preferencias: await preferencias({ sessao, projeto, escopo }) };
  }
  async function importar(json, { sessao, projeto, escopo = 'sessao' } = {}) {
    if (json?._myn !== 'myn-memoria' || !Array.isArray(json.eventos)) throw new Error('arquivo de memória inválido');
    for (const r of json.eventos.slice(0, 10000)) await repo.inserir('eventos', { ...r, tipo: 'memoria', sessao: r.sessao || sessao, projeto: r.projeto || projeto, escopo: r.escopo || escopo });
    for (const [chave, valor] of Object.entries(json.preferencias || {})) await salvarPreferencia(chave, valor, { sessao, projeto, escopo });
    return json.eventos.length;
  }
  async function limpar({ sessao, projeto, escopo = 'sessao' } = {}) {
    const todos = await repo.listar('eventos', 10000);
    const itens = todos.filter((r) => combina(r, { sessao, projeto, escopo }));
    for (const r of itens) if (r.id != null) await repo.remover('eventos', r.id);
    const dono = sessao || projeto || 'global', id = 'pref:' + escopo + ':' + dono;
    if (await repo.obter('sessoes', id)) await repo.remover('sessoes', id);
    return itens.length;
  }
  async function estatisticas({ sessao, projeto, escopo = 'sessao' } = {}) {
    const todos = (await repo.listar('eventos', 10000)).filter((r) => combina(r, { sessao, projeto, escopo }));
    return { registros: todos.filter((r) => !['preferencia', 'resumo'].includes(r.papel)).length, resumos: todos.filter((r) => r.papel === 'resumo').length, caracteres: todos.reduce((n, r) => n + String(r.texto || '').length, 0) };
  }

  return { registrar, contexto, buscar, resumir, preferencia, salvarPreferencia, preferencias, exportar, importar, limpar, estatisticas };
}

export const memoria = criarMemoria(db);
