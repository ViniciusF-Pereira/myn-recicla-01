/** Myn MCP: expõe rotas, plugins, RAG e mídia como ferramentas. JSON-RPC sobre HTTP local. */
import { registrar } from './historico.mjs';
import { planejar } from './planejador.mjs';
import { executarCiclo } from './agendador.mjs';
import { auditarArquitetura } from './arquitetura.mjs';
import { medirDesempenho } from './desempenho.mjs';
import { obterModelos } from './modelos-livres.mjs';

const T = (name, description, properties = [], required = [], extra = {}) => ({
  name, description,
  inputSchema: { type: 'object', properties: Object.fromEntries(properties), required, additionalProperties: false },
  ...extra,
});
const S = (desc) => ({ type: 'string', description: desc });
const N = (desc) => ({ type: 'number', description: desc });
const B = (desc) => ({ type: 'boolean', description: desc });

export const FERRAMENTAS = [
  T('myn_chat', 'Conversa com o Myn-01. Rotas free, sem chave. Use rota="auto" para escolher a melhor.', [['message', S('Mensagem do usuário')], ['rota', S('auto, brave-leo, zai, openrouter, chatgpt, claude')], ['sessao', S('ID da conversa para manter a rota fixa')]], ['message']),
  T('myn_pesquisar', 'Pesquisa local: RAG nos docs + catálogo atual de plugins.', [['query', S('Pergunta ou termo')]], ['query']),
  T('myn_rotas', 'Lista rotas, saúde (score/circuito) e plugins disponíveis.', [], []),
  T('myn_planejar', 'Planeja passos executáveis para um objetivo usando o planejador do Myn.', [['objetivo', S('Objetivo')], ['maxPassos', N('Máximo de passos, até 6')]], ['objetivo']),
  T('myn_loop', 'Executa um ciclo agêntico planejado. Pode gerar mídia, docs e chamadas de rota.', [['objetivo', S('Objetivo do ciclo')], ['maxPassos', N('Máximo de passos, até 6')]], ['objetivo'], { annotations: { readOnlyHint: false } }),
  T('myn_arquitetura', 'Audita módulos, dependências, ciclos e violações de camada.', [], []),
  T('myn_desempenho', 'Mede latência p50, bytes no fio, gzip e 304 das páginas/APIs.', [], []),
  T('myn_modelos', 'Lista modelos livres descobertos por Pollinations, OpenRouter e HuggingFace.', [], []),
  T('myn_plugin', 'Executa qualquer plugin por id (/id no chat).', [['id', S('id do plugin')], ['entrada', S('texto de entrada')]], ['id', 'entrada']),
  T('myn_imagem', 'Gera imagem. Pollinations primeiro; se a cota acabar, desenha o sujeito por palavra-chave localmente.', [['prompt', S('O que gerar')]], ['prompt']),
  T('myn_audio', 'Narra texto em pt-BR com edge-tts (free, sem chave).', [['prompt', S('Texto para narrar')], ['voz', S('Voz edge-tts')]], ['prompt']),
  T('myn_video', 'Gera clipe MP4 a partir de imagem (Pollinations/local + ffmpeg).', [['prompt', S('Cena do vídeo')], ['segundos', N('Duração 3-15')]], ['prompt']),
  T('myn_documento', 'Anexa e extrai texto de documento (PDF, imagem OCR, CSV/TXT/JSON/HTML).', [['nome', S('Nome do arquivo')], ['base64', S('Conteúdo em base64')]], ['nome', 'base64']),
  T('myn_historico', 'Lê o caderno de histórico do Playground.', [['tipo', S('chat, rag, plugin, midia, documento, google')], ['limite', N('Até 200')]], []),
  T('myn_mensagem', 'Envia mensagem real (Telegram, WhatsApp, Discord). Exige confirmação explícita.', [['id', S('id do plugin de mensageria')], ['texto', S('Mensagem')], ['confirmar', B('Deve ser true')]], ['id', 'texto', 'confirmar'], { annotations: { readOnlyHint: false, destructiveHint: true } }),
];

const POR_ID = new Map(FERRAMENTAS.map((f) => [f.name, f]));
let chamadas = new Map();

function erro(id, message) { return { jsonrpc: '2.0', id, error: { code: -32602, message } }; }
function ok(id, texto, isError = false) {
  return { jsonrpc: '2.0', id, result: { resultType: 'complete', content: [{ type: 'text', text: String(texto) }], isError } };
}

async function post(base, caminho, corpo) {
  const r = await fetch(base + caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(180000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'HTTP ' + r.status);
  return d;
}
async function get(base, caminho) {
  const r = await fetch(base + caminho, { signal: AbortSignal.timeout(60000) });
  return r.json();
}

async function executar(nome, a, base) {
  switch (nome) {
    case 'myn_chat': {
      const d = await post(base, '/api/agente', { mensagem: a.message, sessao: a.sessao || 'mcp-local', canal: 'mcp', rota: a.rota || 'auto' });
      return (d.resposta || '') + (d.via ? '\n[via: ' + d.via + ']' : '') + (d.passos?.length ? '\n[passos: ' + d.passos.join(' → ') + ']' : '');
    }
    case 'myn_pesquisar': {
      const d = await post(base, '/api/rag', { q: a.query });
      return JSON.stringify(d.resultados || [], null, 2).slice(0, 12000);
    }
    case 'myn_rotas': {
      const [p, s] = await Promise.all([get(base, '/api/plugins'), get(base, '/api/saude')]);
      const ids = new Set(p.plugins.map((x) => x.id));
      const saude = s.rotas.filter((r) => ids.has(r.id)).slice(0, 20);
      return JSON.stringify({ plugins: p.total, google: 0, saude }, null, 2);
    }
    case 'myn_planejar': {
      const d = await planejar(a.objetivo, { maxPassos: Math.max(1, Math.min(6, Number(a.maxPassos) || 4)) });
      return JSON.stringify(d, null, 2);
    }
    case 'myn_loop': {
      const d = await executarCiclo({ objetivo: a.objetivo, maxPassos: Math.max(1, Math.min(6, Number(a.maxPassos) || 4)), execucoes: [] });
      return JSON.stringify(d, null, 2).slice(0, 14000);
    }
    case 'myn_arquitetura': {
      const d = await auditarArquitetura();
      return JSON.stringify({ resumo: d.resumo, violacoes: d.violacoes }, null, 2);
    }
    case 'myn_desempenho': {
      const d = await medirDesempenho(base, 2);
      return JSON.stringify(d, null, 2);
    }
    case 'myn_modelos': {
      const d = await obterModelos();
      return JSON.stringify({ total: d.total, porFonte: d.porFonte, erros: d.erros, modelos: d.modelos.slice(0, 30) }, null, 2);
    }
    case 'myn_plugin': {
      const d = await post(base, '/api/chat', { message: '/' + a.id + ' ' + a.entrada, rota: 'auto' });
      return d.reply || '';
    }
    case 'myn_imagem': {
      const d = await post(base, '/api/midia', { tipo: 'imagem', prompt: a.prompt });
      return '![' + a.prompt.slice(0, 40) + '](' + base + d.url + ')\n' + d.fonte;
    }
    case 'myn_audio': {
      const d = await post(base, '/api/midia', { tipo: 'audio', prompt: a.prompt, voz: a.voz || 'pt-BR-FranciscaNeural' });
      return '[🔊 áudio](' + base + d.url + ')\n' + d.fonte;
    }
    case 'myn_video': {
      const d = await post(base, '/api/midia', { tipo: 'video', prompt: a.prompt, segundos: a.segundos || 6 });
      return '[🎬 vídeo](' + base + d.url + ')\n' + d.fonte;
    }
    case 'myn_documento': {
      const d = await post(base, '/api/documento', { nome: a.nome, base64: a.base64 });
      return JSON.stringify({ nome: d.nome, chars: (d.texto || '').length, aviso: d.aviso, trecho: (d.texto || '').slice(0, 800) }, null, 2);
    }
    case 'myn_historico': {
      const q = new URLSearchParams();
      if (a.tipo) q.set('tipo', a.tipo);
      if (a.limite) q.set('limite', String(Math.min(200, a.limite)));
      const d = await get(base, '/api/historico?' + q);
      return JSON.stringify(d.itens, null, 2).slice(0, 12000);
    }
    case 'myn_mensagem': {
      if (a.confirmar !== true) throw new Error('CONFIRMAÇÃO NECESSÁRIA: myn_mensagem envia mensagem real. Chame de novo com confirmar=true.');
      const d = await post(base, '/api/chat', { message: '/' + a.id + ' confirmar: ' + a.texto, rota: 'auto' });
      return d.reply || '';
    }
    default: throw new Error('Ferramenta desconhecida: ' + nome);
  }
}

/** Manipula JSON-RPC MCP. `base` é o endereço local do próprio site (loopback fixo). */
export async function handleMcp(req, base) {
  const id = req?.id ?? null;
  if (req?.method === 'initialize') {
    return { jsonrpc: '2.0', id, result: { protocolVersion: '2026-07-28', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'myn-Recicla-01', version: '1.0.0' } } };
  }
  if (req?.method === 'ping' || req?.method === 'notifications/initialized') return req.method === 'ping' ? { jsonrpc: '2.0', id, result: {} } : null;
  if (req?.method === 'tools/list') {
    return { jsonrpc: '2.0', id, result: { resultType: 'complete', tools: FERRAMENTAS, cacheScope: 'public', ttlMs: 300000 } };
  }
  if (req?.method === 'tools/call') {
    const nome = req.params?.name;
    const args = req.params?.arguments || {};
    const ferramenta = POR_ID.get(nome);
    if (!ferramenta) return erro(id, 'Unknown tool: ' + nome);
    // rate limit simples por ferramenta: 60 chamadas / minuto
    const chave = nome + ':' + (req._ip || 'local');
    const n = (chamadas.get(chave) || 0) + 1;
    chamadas.set(chave, n);
    setTimeout(() => chamadas.set(chave, Math.max(0, (chamadas.get(chave) || 1) - 1)), 60000);
    if (n > 60) return erro(id, 'Rate limit: 60 chamadas/minuto');
    for (const campo of ferramenta.inputSchema.required) {
      if (args[campo] === undefined || args[campo] === null || args[campo] === '') return ok(id, 'Input validation error: campo obrigatório ausente: ' + campo, true);
    }
    if (Object.keys(args).some((k) => !(k in ferramenta.inputSchema.properties))) return ok(id, 'Input validation error: parâmetro não declarado', true);
    try {
      const texto = await executar(nome, args, base);
      registrar('mcp', { input: nome + ' ' + JSON.stringify(args).slice(0, 200), output: String(texto).slice(0, 400) });
      return ok(id, texto);
    } catch (e) {
      registrar('mcp', { input: nome, output: 'erro: ' + e.message.slice(0, 200) });
      return ok(id, 'Falha na ferramenta ' + nome + ': ' + e.message.slice(0, 300), true);
    }
  }
  return erro(id, 'Method not found: ' + req?.method);
}
