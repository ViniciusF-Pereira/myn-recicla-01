/** Orquestrador explícito: 3 workers em rotas diferentes, paralelismo com trava de aba. */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { carregarConfigAsync, criarGateway, criarTrava } from '../src/gateway.mjs';
import { criarFerramentas } from '../src/tools.mjs';
import { orquestrar } from '../src/agente.mjs';

const config = await carregarConfigAsync();
const gateway = criarGateway(config.gateway);
const workspace = await mkdtemp(path.join(tmpdir(), 'myn-portable-orquestra-'));
const tarefas = [
  { rota: 'brave-leo', arquivo: 'README', conteudo: 'orquestrador' },
  { rota: 'brave-leo', arquivo: 'rotas', conteudo: 'workers-paralelos' },
  { rota: 'brave-leo', arquivo: 'plano', conteudo: 'validar-integrar' },
];
const ferramentas = criarFerramentas(workspace, tarefas.map((t) => t.arquivo));
const iniciado = Date.now();
const resultados = await orquestrar({ gateway, config, tarefas, trava: criarTrava(), ferramentas, log: (x) => console.log(JSON.stringify(x)) });
await writeFile('outputs-orquestracao.json', JSON.stringify({ ms: Date.now() - iniciado, workspace, resultados }, null, 2));
console.log(JSON.stringify({ concluidas: resultados.filter((r) => r.ok).length + '/' + resultados.length, ms: Date.now() - iniciado }, null, 2));
