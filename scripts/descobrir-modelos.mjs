/** Atualiza config/modelos-descobertos.json usando apenas endpoints públicos. */
import { writeFile } from 'node:fs/promises';
import { descobrirModelos } from '../src/modelos-livres.mjs';

const dados = await descobrirModelos();
await writeFile('config/modelos-descobertos.json', JSON.stringify(dados, null, 2) + '\n');
console.log(JSON.stringify({ total: dados.total, porFonte: dados.porFonte, erros: dados.erros }));
