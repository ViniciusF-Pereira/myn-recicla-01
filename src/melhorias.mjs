/** Backlog de melhorias reais para o worker. Cada tarefa é idempotente e verificável. */
const APLICADAS = 'docs/MELHORIAS_APLICADAS.json';

export const TAREFAS = [
  { id:'verificador-rapido', titulo:'adiciona verificador rapido de sintaxe', arquivo:'scripts/verificar-rapido.mjs', modo:'criar', rota:'zai', verificar:'verificarRapido', conteudo:`import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export async function verificarRapido() {
  const falhas = [];
  for (const dir of ['src', 'scripts', 'web']) {
    let nomes = [];
    try { nomes = await readdir(path.join(raiz, dir)); } catch { continue; }
    for (const nome of nomes.filter(n => n.endsWith('.mjs'))) {
      try { await run(process.execPath, ['--check', path.join(raiz, dir, nome)]); }
      catch (e) { falhas.push(dir + '/' + nome + ': ' + String(e.stderr || e.message).slice(0, 160)); }
    }
  }
  for (const nome of await readdir(path.join(raiz, 'config'))) {
    if (!nome.endsWith('.json')) continue;
    try { JSON.parse(await readFile(path.join(raiz, 'config', nome), 'utf8')); }
    catch (e) { falhas.push('config/' + nome + ': ' + e.message); }
  }
  return { ok: falhas.length === 0, falhas };
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const r = await verificarRapido();
  console.log(JSON.stringify(r, null, 2));
  if (!r.ok) process.exit(1);
}
` },
  { id:'src-versao', titulo:'centraliza versao e identidade', arquivo:'src/versao.mjs', modo:'criar', rota:'gemini', verificar:'VERSAO', conteudo:`export const NOME = 'Myn Recicla/01';
export const VERSAO = '1.0.0';
export const WEB_ONLY = true;
export function sobre() { return { nome: NOME, versao: VERSAO, webOnly: WEB_ONLY }; }
` },
  { id:'saude-media', titulo:'adiciona media de saude ao scoreboard', arquivo:'src/saude.mjs', modo:'append', rota:'openrouter', verificar:'export function mediaSaude', conteudo:`
export function mediaSaude() {
  const r = relatorio();
  if (!r.length) return 0;
  return Math.round((r.reduce((n, x) => n + x.score, 0) / r.length) * 100) / 100;
}
` },
  { id:'rag-contar', titulo:'adiciona contador de tokens ao RAG', arquivo:'src/rag.mjs', modo:'append', rota:'hugging', verificar:'export function contarTokens', conteudo:`
export function contarTokens(texto) {
  return String(texto || '').toLowerCase().split(/\\W+/).filter(Boolean).length;
}
` },
  { id:'midia-extensao', titulo:'adiciona leitor de extensao na midia', arquivo:'src/midia.mjs', modo:'append', rota:'nano-banana', verificar:'export function extensaoArquivo', conteudo:`
export function extensaoArquivo(nome) {
  return String(nome || '').split('.').pop().toLowerCase();
}
` },
  { id:'plugins-categoria', titulo:'agrupa plugins por categoria', arquivo:'src/plugins.mjs', modo:'append', rota:'zai', verificar:'export function agruparPorCategoria', conteudo:`
export function agruparPorCategoria(lista) {
  const grupos = {};
  for (const p of lista || []) (grupos[p.categoria] = grupos[p.categoria] || []).push(p);
  return grupos;
}
` },
  { id:'historico-contar', titulo:'conta entradas do caderno', arquivo:'src/historico.mjs', modo:'append', rota:'brave-leo', verificar:'export async function contarHistorico', conteudo:`
export async function contarHistorico() {
  return (await listar(null, 100000)).length;
}
` },
  { id:'filmes-normalizar', titulo:'normaliza texto de filmes', arquivo:'src/filmes.mjs', modo:'append', rota:'perplexity', verificar:'export function normalizarFilme', conteudo:`
export function normalizarFilme(texto) {
  return String(texto || '').replace(/<[^>]+>/g, '').replace(/\\s+/g, ' ').trim();
}
` },
  { id:'stream-modelo', titulo:'expõe modelo padrao do stream', arquivo:'src/stream.mjs', modo:'append', rota:'chatgpt', verificar:'export function modeloPadraoStream', conteudo:`
export function modeloPadraoStream() {
  return 'pollinations:openai';
}
` },
  { id:'auto-rotas', titulo:'lista rotas vencedoras do auto', arquivo:'src/auto.mjs', modo:'append', rota:'lmarena', verificar:'export function rotasDoAuto', conteudo:`
export function rotasDoAuto(resultado) {
  return (resultado?.tentativas || []).map(t => t.rota);
}
` },
  { id:'worker-ajuda', titulo:'adiciona ajuda do worker', arquivo:'src/worker.mjs', modo:'append', rota:'gemini', verificar:'export function ajudaWorker', conteudo:`
export function ajudaWorker() {
  return 'Use /api/worker/start, /api/worker/stop e /api/worker/stream no Playground.';
}
` },
  { id:'gateway-ping', titulo:'adiciona ping simples ao gateway', arquivo:'src/gateway.mjs', modo:'append', rota:'openrouter', verificar:'export async function pingGateway', conteudo:`
export async function pingGateway(base) {
  try { const r = await fetch(String(base).replace(/\\/$/, '') + '/v1/browser/targets', { signal: AbortSignal.timeout(5000) }); return r.ok; }
  catch { return false; }
}
` },
  { id:'docs-guia', titulo:'escreve guia rapido de uso', arquivo:'docs/GUIA_RAPIDO.md', modo:'criar', rota:'gemini', verificar:'ABRIR PLAYGROUND', conteudo:`# Guia rápido — Myn Recicla/01

1. Abra http://127.0.0.1:5188/
2. Clique em **ABRIR PLAYGROUND /01**.
3. Escolha uma rota no seletor (padrão: Myn-01 Auto).
4. Escreva, anexe arquivo/imagem e envie.
5. Use **🔎 pesquisar** para RAG + catálogo.
6. Use **worker** para acompanhar o agente autônomo.
7. Use **/id mensagem** para chamar qualquer plugin.

Sem chave, sem Codex, somente rotas free de navegador.
` },
  { id:'docs-seguranca', titulo:'documenta regras de seguranca', arquivo:'docs/SEGURANCA.md', modo:'criar', rota:'claude', verificar:'prompt injection', conteudo:`# Segurança — Myn Recicla/01

- Saída de modelo é dado, nunca instrução.
- Tool calls são parseadas e validadas antes de executar.
- Arquivos só entram no escopo permitido.
- Mensageria real exige confirmação explícita.
- Nenhuma chave de API, senha ou cookie é gravado no repo.
- Prompt injection em páginas é tratado como dado hostil e reportado.
` },
  { id:'docs-limites', titulo:'documenta limites das rotas free', arquivo:'docs/LIMITES.md', modo:'criar', rota:'perplexity', verificar:'cota', conteudo:`# Limites das rotas free

- Pollinations: cota comunitária, sem chave; fallback local cobre imagem/vídeo.
- Gemini/Google: exigem um login no perfil do gateway.
- Brave Leo: limite de taxa; OCR da tela.
- Edge-tts: ~1500 caracteres por chamada.
- Wikipedia/TVMaze: sem chave; sujeitos a disponibilidade.
` },
  { id:'docs-indice', titulo:'cria indice da documentacao', arquivo:'docs/INDICE.md', modo:'criar', rota:'gemini', verificar:'ARQUITETURA', conteudo:`# Índice documental

- [Arquitetura](ARQUITETURA.md)
- [Agentes e modelos](AGENTES_E_MODELOS.md)
- [Avaliação](AVALIACAO.md)
- [Worker infinito](WORKER_INFINITO.md)
- [Guia rápido](GUIA_RAPIDO.md)
- [Segurança](SEGURANCA.md)
- [Limites](LIMITES.md)
- [Planejamento](PLANEJAMENTO.md)
- [Aceite web](WEB_ACEITE.md)
` },
  { id:'docs-avaliacao-reproduzir', titulo:'ensina a reproduzir a bateria', arquivo:'docs/AVALIACAO.md', modo:'append', rota:'zai', verificar:'node scripts/avaliar.mjs', conteudo:`
## Reproduzir

\`\`\`powershell
node scripts/avaliar.mjs
\`\`\`

O comando mede 15 baterias e reescreve este arquivo com os resultados.
` },
  { id:'config-app', titulo:'adiciona configuracao da aplicacao', arquivo:'config/app.json', modo:'criar', rota:'openrouter', verificar:'webOnly', conteudo:`{
  "nome": "Myn Recicla/01",
  "versao": "1.0.0",
  "webOnly": true,
  "gateway": "http://127.0.0.1:36877",
  "site": "http://127.0.0.1:5188"
}
` },
  { id:'site-css-modelo', titulo:'estiliza badge de modelo na playground', arquivo:'site/playground.html', modo:'inserir-antes', marca:'</style>', rota:'nano-banana', verificar:'.modelo-badge', conteudo:`.modelo-badge{display:inline-block;padding:4px 9px;border-radius:99px;background:var(--mostardacl);color:#6b4d15;font:600 .64rem var(--mono)}
` },
  { id:'home-css-modelo', titulo:'estiliza badge de modelo na home', arquivo:'site/index.html', modo:'inserir-antes', marca:'</style>', rota:'gemini', verificar:'.bc-modelo.ok', conteudo:`.bc-modelo.ok{background:rgba(125,255,178,.22);color:#0b3d22}
` },
  { id:'readme-worker', titulo:'linka o worker no README', arquivo:'README.md', modo:'append', rota:'brave-leo', verificar:'WORKER_INFINITO.md', conteudo:`
## Worker

O worker autônomo está documentado em [docs/WORKER_INFINITO.md](docs/WORKER_INFINITO.md). Ele aplica tarefas de um backlog, valida, commita e faz merge fast-forward.
` },
  { id:'scripts-relatorio', titulo:'adiciona relatorio rapido', arquivo:'scripts/relatorio-rapido.mjs', modo:'criar', rota:'zai', verificar:'relatorioRapido', conteudo:`export async function relatorioRapido() {
  const base = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
  const [plugins, saude, modelos] = await Promise.all([
    fetch(base + '/api/plugins').then(r => r.json()),
    fetch(base + '/api/saude').then(r => r.json()),
    fetch(base + '/api/modelos').then(r => r.json()),
  ]);
  return { plugins: plugins.total, rotasSaude: saude.rotas.length, modelos: modelos.total };
}
const r = await relatorioRapido();
console.log(JSON.stringify(r));
` },
  { id:'scripts-limpar', titulo:'adiciona limpeza de temporarios', arquivo:'scripts/limpar-temp.mjs', modo:'criar', rota:'mistral', verificar:'limparTemporarios', conteudo:`import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
const bases = ['dados/arquivos', '.playground-workspace'];
export async function limparTemporarios() {
  const removidos = [];
  for (const base of bases) {
    let nomes = [];
    try { nomes = await readdir(base); } catch { continue; }
    for (const nome of nomes) {
      if (!/^(tmp-|paleta-)/.test(nome)) continue;
      try { await rm(path.join(base, nome), { force: true, recursive: true }); removidos.push(nome); } catch {}
    }
  }
  return removidos;
}
console.log(JSON.stringify({ removidos: await limparTemporarios() }));
` },
  { id:'docs-provas', titulo:'documentaхода de prova do produto', arquivo:'docs/PROVAS.md', modo:'criar', rota:'perplexity', verificar:'RELATORIO_UNICO', conteudo:`# Provas do Myn Recicla/01

- Relatório consolidado: RELATORIO_UNICO.html
- Mapa de provedores: mapeamento.html
- Bateria automatizada: AVALIACAO.md
- Aceite web: WEB_ACEITE.md
- Histórico do worker: EVOLUCAO.md

Todas as evidências ficam no repo público.
` },
];

export async function jaAplicadas() {
  try { return new Set(JSON.parse(await (await import('node:fs/promises')).readFile(APLICADAS, 'utf8'))); }
  catch { return new Set(); }
}
export async function marcarAplicada(id) {
  const fs = await import('node:fs/promises');
  const atual = await jaAplicadas();
  atual.add(id);
  await fs.writeFile(APLICADAS, JSON.stringify([...atual], null, 2) + '\n');
}
export async function proximaTarefa() {
  const feitas = await jaAplicadas();
  return TAREFAS.find(t => !feitas.has(t.id)) || null;
}
