/** Envia mensagens para uma sessão real do OpenCode usando o CLI autenticado da máquina. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

const run = promisify(execFile);
const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
let config = null;

async function carregarConfig() {
  if (config) return config;
  const arquivo = process.env.MYN_OPENCODE_CONFIG || path.join(DADOS, 'opencode-session.json');
  config = JSON.parse(await readFile(arquivo, 'utf8'));
  if (!config.sessionID || !config.bin) throw new Error('configuração OpenCode incompleta');
  return config;
}

async function api(metodo, caminho, dados, timeoutMs = 120000) {
  const c = await carregarConfig();
  const args = ['api', metodo, caminho];
  if (dados !== undefined) args.push('--data', JSON.stringify(dados));
  const r = await run(c.bin, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
  const texto = String(r.stdout || '').trim();
  return texto ? JSON.parse(texto) : {};
}

export async function enviarParaSessao(texto, { arquivos = [] } = {}) {
  const c = await carregarConfig();
  const inicio = Date.now();
  const files = arquivos.map((a) => ({ uri: a.caminho, source: { type: 'uri', uri: a.caminho }, name: a.nome, description: 'arquivo enviado pelo Telegram' }));
  const promptID = 'msg_tg_' + randomBytes(8).toString('hex');
  const r = await api('post', '/api/session/' + c.sessionID + '/prompt', { id: promptID, text: String(texto), files }, 120000);
  return { ...r, inicio, promptID, sessionID: c.sessionID };
}

export async function aguardarResposta(inicio, promptID, timeoutMs = 600000) {
  const c = await carregarConfig();
  const fim = Date.now() + timeoutMs;
  while (Date.now() < fim) {
    const r = await api('get', '/api/session/' + c.sessionID + '/message?limit=30&order=desc', undefined, 30000);
    const lista = r.data || [];
    const prompt = lista.find((m) => m.id === promptID && m.type === 'user');
    const limite = prompt?.time?.created || inicio;
    for (const m of lista) {
      if (m.type !== 'assistant' || (m.time?.created || 0) <= limite) continue;
      const texto = (m.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
      if (texto) return { texto, messageID: m.id, sessionID: c.sessionID };
    }
    await new Promise((ok) => setTimeout(ok, 2000));
  }
  throw new Error('OpenCode não respondeu dentro do tempo limite');
}

export async function conversarNoOpenCode(texto, opcoes = {}) {
  const enviado = await enviarParaSessao(texto, opcoes);
  return aguardarResposta(enviado.inicio, enviado.promptID, opcoes.timeoutMs || 600000);
}
