/** Myn-01 Auto · Free: escolhe rotas utilizáveis, roda loops e faz fallback automático. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { rodarLoop } from './loop.mjs';
import { contextoPara } from './rag.mjs';
import { escolherRotas, registrar } from './saude.mjs';

const RAIZ = process.cwd();

async function rotasUtilizaveis(config) {
  try {
    const mapa = JSON.parse(await readFile(path.join(RAIZ, 'site/mapeamento.json'), 'utf8'));
    const boas = mapa.resultados.filter((r) => r.estado === 'utilizavel').map((r) => r.id).filter((id) => config.rotas[id]);
    if (boas.length) return boas;
  } catch { /* sem mapa ainda */ }
  const preferidas = ['brave-leo', 'zai', 'openrouter'].filter((id) => config.rotas[id]);
  return preferidas.length ? preferidas : Object.keys(config.rotas).slice(0, 3);
}

export async function executarAuto({ objetivo, gateway, config, ferramentas, trava, maxPassos = 4, log = () => {} }) {
  const ctx = await contextoPara(objetivo);
  const candidatas = escolherRotas(await rotasUtilizaveis(config));
  const tentativas = [];
  for (const id of candidatas) {
    const rota = config.rotas[id];
    if (!rota) continue;
    const inicio = Date.now();
    log({ etapa: 'tentar_rota', rota: id });
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 60000);
    try {
      const resultado = await trava(() => rodarLoop({
        objetivo, gateway, rota, ferramentas, arquivos: ['resultado'],
        maxPassos, checkpointDir: path.join(RAIZ, 'docs'), sinal: controle.signal,
        log: (x) => log({ rota: id, ...x }),
      }));
      const sucesso = resultado.historico.some((h) => h.acao === 'FINAL' || (h.aceito && h.resultado?.ok !== false));
      registrar(id, { ok: sucesso, ms: Date.now() - inicio, erro: sucesso ? '' : 'sem_resposta' });
      tentativas.push({ rota: id, ms: Date.now() - inicio, passos: resultado.passos, sucesso, historico: resultado.historico });
      log({ etapa: 'resultado_rota', rota: id, sucesso });
      if (sucesso) return { modo: 'auto', objetivo, rotaVencedora: id, tentativas, fontes: ctx.fontes, sucesso: true };
    } catch (erro) {
      registrar(id, { ok: false, ms: Date.now() - inicio, erro: String(erro.message).slice(0, 160) });
      tentativas.push({ rota: id, ms: Date.now() - inicio, sucesso: false, erro: String(erro.message).slice(0, 160) });
    } finally {
      clearTimeout(timer);
    }
  }
  return { modo: 'auto', objetivo, rotaVencedora: null, tentativas, fontes: ctx.fontes, sucesso: false };
}
export function rotasDoAuto(r){return (r?.tentativas||[]).map(t=>t.rota)}
