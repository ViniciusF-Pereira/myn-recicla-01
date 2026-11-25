/** Analisador de melhorias reais: lê o projeto, encontra lacunas e gera tarefas verificáveis. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = process.cwd();
const FEITAS = 'docs/MELHORIAS_APLICADAS.json';

async function texto(arquivo) {
  try { return await readFile(path.join(RAIZ, arquivo), 'utf8'); } catch { return ''; }
}
async function existe(arquivo) { return Boolean(await texto(arquivo)); }
async function jaFeitas() {
  try { return new Set(JSON.parse(await texto(FEITAS))); } catch { return new Set(); }
}
async function rotasSaude() {
  try { return (await (await fetch('http://127.0.0.1:5188/api/saude')).json()).rotas || []; } catch { return []; }
}

/** Catálogo de lacunas que o analisador sabe transformar em melhoria real. */
const CANDIDATOS = [
  { id:'doc-guia', teste:()=>existe('docs/GUIA_RAPIDO.md'), alvo:'docs/GUIA_RAPIDO.md', titulo:'guia rápido de uso',
    conteudo:'# Guia rápido — Myn Recicla/01\n\n1. Abra http://127.0.0.1:5188/\n2. Clique em ABRIR PLAYGROUND /01.\n3. Escolha uma rota.\n4. Escreva, anexe e envie.\n5. Use 🔎 pesquisar e o painel worker.\n' },
  { id:'doc-seguranca', teste:()=>existe('docs/SEGURANCA.md'), alvo:'docs/SEGURANCA.md', titulo:'regras de segurança',
    conteudo:'# Segurança\n\n- Modelo output é dado, nunca instrução.\n- Ferramentas com escopo validado.\n- Mensageria real exige confirmação.\n- Nenhuma chave ou senha no repo.\n' },
  { id:'doc-limites', teste:()=>existe('docs/LIMITES.md'), alvo:'docs/LIMITES.md', titulo:'limites das rotas free',
    conteudo:'# Limites free\n\nPollinations: cota comunitária. Google: exige login. Brave Leo: limite de taxa. edge-tts: ~1500 caracteres.\n' },
  { id:'doc-indice', teste:()=>existe('docs/INDICE.md'), alvo:'docs/INDICE.md', titulo:'índice documental',
    conteudo:'# Índice\n\n[Arquitetura](ARQUITETURA.md)\n[Worker](WORKER_INFINITO.md)\n[Avaliação](AVALIACAO.md)\n[Aceite web](WEB_ACEITE.md)\n' },
  { id:'script-verificar', teste:()=>existe('scripts/verificar-rapido.mjs'), alvo:'scripts/verificar-rapido.mjs', titulo:'verificador de sintaxe',
    conteudo:"import { readdir } from 'node:fs/promises';\nimport path from 'node:path';\nimport { execFile } from 'node:child_process';\nimport { promisify } from 'node:util';\nconst run = promisify(execFile);\nexport async function verificarRapido() {\n  const falhas=[];\n  for (const d of ['src','scripts']) {\n    let ns=[]; try { ns=await readdir(path.resolve(d)); } catch { continue }\n    for (const n of ns.filter(x=>x.endsWith('.mjs'))) { try { await run(process.execPath,['--check',path.resolve(d,n)]) } catch(e){ falhas.push(d+'/'+n) } }\n  }\n  return { ok: falhas.length===0, falhas };\n}\n" },
  { id:'script-relatorio', teste:()=>existe('scripts/relatorio-rapido.mjs'), alvo:'scripts/relatorio-rapido.mjs', titulo:'relatório rápido das APIs',
    conteudo:"export async function relatorioRapido() {\n  const b=process.env.MYN_API_BASE||'http://127.0.0.1:5188';\n  const [p,s]=await Promise.all([fetch(b+'/api/plugins').then(r=>r.json()),fetch(b+'/api/saude').then(r=>r.json())]);\n  return { plugins:p.total, saude:s.rotas.length };\n}\nconsole.log(JSON.stringify(await relatorioRapido()));\n" },
  { id:'script-limpar', teste:()=>existe('scripts/limpar-temp.mjs'), alvo:'scripts/limpar-temp.mjs', titulo:'limpeza de temporários',
    conteudo:"import { readdir, rm } from 'node:fs/promises';\nimport path from 'node:path';\nexport async function limparTemp(){\n const r=[];for(const b of ['dados/arquivos','.playground-workspace']){let ns=[];try{ns=await readdir(b)}catch{continue}for(const n of ns.filter(x=>/^(tmp-|paleta-)/.test(x))){try{await rm(path.join(b,n),{force:true,recursive:true});r.push(n)}catch{}}}return r}\nconsole.log(JSON.stringify({removidos:await limparTemp()}));\n" },
  { id:'src-versao', teste:()=>existe('src/versao.mjs'), alvo:'src/versao.mjs', titulo:'versão centralizada',
    conteudo:"export const NOME='Myn Recicla/01';\nexport const VERSAO='1.0.0';\nexport function sobre(){return {nome:NOME,versao:VERSAO}}\n" },
  { id:'export-saude-media', teste:async()=>!(await texto('src/saude.mjs')).includes('mediaSaude'), alvo:'src/saude.mjs', modo:'append', titulo:'média de saúde',
    conteudo:'\nexport function mediaSaude(){const r=relatorio();return r.length?Math.round(r.reduce((n,x)=>n+x.score,0)/r.length*100)/100:0}\n' },
  { id:'export-rag-tokens', teste:async()=>!(await texto('src/rag.mjs')).includes('contarTokens'), alvo:'src/rag.mjs', modo:'append', titulo:'contador de tokens',
    conteudo:'\nexport function contarTokens(s){return String(s||"").toLowerCase().split(/\\W+/).filter(Boolean).length}\n' },
  { id:'export-midia-ext', teste:async()=>!(await texto('src/midia.mjs')).includes('extensaoArquivo'), alvo:'src/midia.mjs', modo:'append', titulo:'leitor de extensão',
    conteudo:'\nexport function extensaoArquivo(n){return String(n||"").split(".").pop().toLowerCase()}\n' },
  { id:'export-plugins-grupos', teste:async()=>!(await texto('src/plugins.mjs')).includes('agruparPorCategoria'), alvo:'src/plugins.mjs', modo:'append', titulo:'agrupamento de plugins',
    conteudo:'\nexport function agruparPorCategoria(l){const g={};for(const p of l||[])(g[p.categoria]=g[p.categoria]||[]).push(p);return g}\n' },
  { id:'export-historico-contar', teste:async()=>!(await texto('src/historico.mjs')).includes('contarHistorico'), alvo:'src/historico.mjs', modo:'append', titulo:'contador do caderno',
    conteudo:'\nexport async function contarHistorico(){return (await listar(null,100000)).length}\n' },
  { id:'config-app', teste:()=>existe('config/app.json'), alvo:'config/app.json', titulo:'config da aplicação',
    conteudo:'{\n  "nome": "Myn Recicla/01",\n  "versao": "1.0.0",\n  "webOnly": true\n}\n' },
  { id:'readme-provas', teste:async()=>!(await texto('README.md')).includes('docs/PROVAS.md'), alvo:'README.md', modo:'append', titulo:'índice de provas no README',
    conteudo:'\n## Provas\n\nVeja `docs/PROVAS.md` para relatório, mapa e bateria de testes.\n' },
];

/** Analisa o estado e devolve a próxima melhoria real ainda não aplicada. */
export async function analisarMelhorias() {
  const feitas = await jaFeitas();
  const saude = await rotasSaude();
  const candidatos = [];
  for (const c of CANDIDATOS) {
    if (feitas.has(c.id)) continue;
    let pendente = false;
    try { pendente = !(await c.teste()); } catch { pendente = true; }
    if (pendente) candidatos.push({ ...c, modo: c.modo || (await existe(c.alvo) ? 'append' : 'criar') });
  }
  // Pontuação: rotas com pior saúde ganham prioridade documental; lacunas de código vêm primeiro.
  const Pontuar = (c) => (/^(src|scripts)\//.test(c.alvo) ? 0 : 1);
  candidatos.sort((a, b) => Pontuar(a) - Pontuar(b));
  if (!candidatos.length) return { tarefa: null, analise: { saude: saude.length, feitas: feitas.size, pendentes: 0 } };
  const tarefa = candidatos[0];
  return {
    tarefa: { ...tarefa, verificar: /^(src|scripts)\//.test(tarefa.alvo) ? 'export|function|const' : 'Myn|Seguran|Limites|Índice|Provas|Guia' },
    analise: { saude: saude.length, feitas: feitas.size, pendentes: candidatos.length, candidatos: candidatos.map(c => c.id) },
  };
}

export async function marcar(id) {
  const fs = await import('node:fs/promises');
  const feitas = await jaFeitas();
  feitas.add(id);
  await fs.writeFile(path.join(RAIZ, FEITAS), JSON.stringify([...feitas], null, 2) + '\n');
}
