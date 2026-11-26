/** Supervisor de 6h: observa mensagens do usuário, critica riscos e mantém o worker de melhoria ativo. */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { adquirirLock } from './lock.mjs';
import { enviarTelegram } from './telegram-ponte.mjs';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
let ativo = false, timer = null, liberarLock = null, ciclos = 0, ultimo = null, iniciadoEm = null, terminaEm = null;
const offsets = { telegram: 0, historico: 0 };

export function criticar(texto) {
  const t = String(texto || '');
  const falhas = [], recomendacoes = [];
  let risco = 0;
  if (/google|gemini/i.test(t)) { risco = 3; falhas.push('viola a política do produto sem Google/Gemini'); recomendacoes.push('use Pollinations, OpenRouter, HuggingFace ou rota local'); }
  if (/manda|enviar|mensagem|telegram|whatsapp|discord/i.test(t) && !/confirmar|confirma/i.test(t)) { risco = Math.max(risco, 2); falhas.push('ação de mensageria sem confirmação explícita'); recomendacoes.push('confirme destinatário e conteúdo antes de enviar'); }
  if (/melhora|melhorar|corrige|corrigir|otimiza|otimizar|refatora/i.test(t) && !/teste|node --test|arquivo|src\/|scripts\//i.test(t)) { risco = Math.max(risco, 1); falhas.push('pedido de código sem arquivo ou critério de teste'); recomendacoes.push('use /melhorar arquivo | correção'); }
  if (/apaga|deleta|remove tudo|liberar geral|sudo|rm -rf/i.test(t)) { risco = 3; falhas.push('ação destrutiva ou ampla demais'); recomendacoes.push('limite o escopo e crie backup/teste antes'); }
  if (t.trim().length < 8) { risco = Math.max(risco, 1); falhas.push('ideia curta demais para virar tarefa verificável'); recomendacoes.push('descreva resultado esperado e como validar'); }
  return { risco, veredito: risco >= 3 ? 'bloquear' : risco === 2 ? 'revisar' : risco === 1 ? 'refinar' : 'ok', falhas, recomendacoes };
}

async function lerLinhas(arquivo, inicio) {
  try {
    const texto = await readFile(arquivo, 'utf8');
    const linhas = texto.split(/\r?\n/);
    const novas = linhas.slice(inicio).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    return { novas, offset: linhas.length };
  } catch { return { novas: [], offset: inicio }; }
}

async function registrar(dados) {
  await mkdir(DADOS, { recursive: true });
  await appendFile(path.join(DADOS, 'supervisor-eventos.jsonl'), JSON.stringify({ t: new Date().toISOString(), ...dados }) + '\n').catch(() => {});
}

async function garantirWorker() {
  try {
    const base = 'http://127.0.0.1:' + (process.env.PORTA || 5188);
    const st = await fetch(base + '/api/worker-melhoria/status').then((r) => r.json());
    if (!st.ativo) await fetch(base + '/api/worker-melhoria/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ maxCiclos: 1000, intervaloMs: 4000 }) });
  } catch { /* servidor pode estar iniciando */ }
}

async function ciclo() {
  if (!ativo) return;
  ciclos++;
  const telegram = await lerLinhas(path.join(DADOS, 'telegram-ponte.jsonl'), offsets.telegram);
  const historico = await lerLinhas(path.join(DADOS, 'historico.jsonl'), offsets.historico);
  offsets.telegram = telegram.offset; offsets.historico = historico.offset;
  const mensagens = [
    ...telegram.novas.filter((e) => e.direcao === 'recebida').map((e) => e.texto),
    ...historico.novas.filter((e) => e.tipo === 'chat').map((e) => e.input),
  ].filter(Boolean);
  for (const texto of mensagens) {
    const critica = criticar(texto);
    if (!critica.risco && !/ideia|melhora|corrige|otimiza/i.test(texto)) continue;
    await registrar({ tipo: 'critica', texto: String(texto).slice(0, 500), ...critica });
    const aviso = `🧠 Supervisor\nVeredito: ${critica.veredito}\n${critica.falhas.map((f) => '• ' + f).join('\n')}\n${critica.recomendacoes.map((r) => '→ ' + r).join('\n')}`;
    await enviarTelegram(aviso).catch(() => {});
    ultimo = { t: new Date().toISOString(), texto: String(texto).slice(0, 180), ...critica };
  }
  await garantirWorker();
  if (Date.now() < terminaEm) timer = setTimeout(ciclo, 15000);
  else { ativo = false; await liberarLock?.(); liberarLock = null; await registrar({ tipo: 'finalizado', ciclos }); }
}

export async function iniciarSupervisor({ duracaoMs = 6 * 60 * 60 * 1000, intervaloMs = 15000 } = {}) {
  if (ativo) return { ok: false, erro: 'supervisor já ativo' };
  const lock = await adquirirLock('supervisor');
  if (!lock.ok) return { ok: false, erro: lock.motivo };
  liberarLock = lock.liberar; ativo = true; ciclos = 0;
  iniciadoEm = new Date().toISOString(); terminaEm = Date.now() + duracaoMs;
  offsets.telegram = (await lerLinhas(path.join(DADOS, 'telegram-ponte.jsonl'), 0)).offset;
  offsets.historico = (await lerLinhas(path.join(DADOS, 'historico.jsonl'), 0)).offset;
  await registrar({ tipo: 'iniciado', duracaoMs, intervaloMs });
  timer = setTimeout(ciclo, Math.max(1000, intervaloMs));
  return { ok: true, status: statusSupervisor() };
}

export function statusSupervisor() {
  return { ativo, ciclos, iniciadoEm, terminaEm, ultimo, duracaoMs: terminaEm && iniciadoEm ? terminaEm - Date.parse(iniciadoEm) : null };
}

export function pararSupervisor() {
  if (!ativo) return { ok: false, erro: 'supervisor não está ativo' };
  ativo = false; clearTimeout(timer); liberarLock?.(); liberarLock = null;
  return { ok: true, status: statusSupervisor() };
}
