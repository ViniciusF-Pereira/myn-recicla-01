/** Smoke: uma rota Browser responde e uma tool é executada. */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { carregarConfigAsync, criarGateway } from '../src/gateway.mjs';
import { criarFerramentas } from '../src/tools.mjs';
import { orquestrar } from '../src/agente.mjs';
import { criarTrava } from '../src/gateway.mjs';

const config = await carregarConfigAsync();
const gateway = criarGateway(config.gateway);
const workspace = await mkdtemp(path.join(tmpdir(), 'myn-portable-smoke-'));
const ferramentas = criarFerramentas(workspace, ['smoke']);
const tarefas = [{ rota: 'brave-leo', arquivo: 'smoke', conteudo: 'OK' }];
const r = await orquestrar({ gateway, config, tarefas, trava: criarTrava(), ferramentas, log: (x) => console.log(JSON.stringify(x)) });
console.log(JSON.stringify({ ok: r.every((x) => x.ok), resultados: r, workspace }, null, 2));
process.exitCode = r.every((x) => x.ok) ? 0 : 3;
