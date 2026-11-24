/** Tarefa longa: 6 arquivos, uma rota Browser decidindo, tools validadas. */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { carregarConfigAsync, criarGateway, criarTrava } from '../src/gateway.mjs';
import { criarFerramentas } from '../src/tools.mjs';
import { orquestrar } from '../src/agente.mjs';

const config = await carregarConfigAsync();
const gateway = criarGateway(config.gateway);
const workspace = await mkdtemp(path.join(tmpdir(), 'myn-portable-longa-'));
const tarefas = [
  { rota: 'zai', arquivo: 'README', conteudo: 'guia-myn-portable' },
  { rota: 'hugging', arquivo: 'rotas', conteudo: 'rotas-browser' },
  { rota: 'openrouter', arquivo: 'plano', conteudo: 'planejar-agir-validar' },
  { rota: 'chatgpt', arquivo: 'notas', conteudo: 'sem-chaves' },
  { rota: 'claude', arquivo: 'resumo', conteudo: 'portavel' },
  { rota: 'zai', arquivo: 'config', conteudo: 'browser-only' },
];
const ferramentas = criarFerramentas(workspace, tarefas.map((t) => t.arquivo));
const resultados = await orquestrar({ gateway, config, tarefas, trava: criarTrava(), ferramentas, log: (x) => console.log(JSON.stringify(x)) });
await writeFile('outputs-ultima-tarefa.json', JSON.stringify({ workspace, resultados }, null, 2));
console.log(JSON.stringify({ concluidas: resultados.filter((r) => r.ok).length + '/' + resultados.length, workspace }, null, 2));
