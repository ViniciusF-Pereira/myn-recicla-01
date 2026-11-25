import { readFile } from 'node:fs/promises';
export async function exportarCaderno(){try{return JSON.parse(await readFile('dados/historico.jsonl','utf8').catch(()=>'[]'))}catch{return []}}
const d=await exportarCaderno();console.log(JSON.stringify({linhas:d.length}));

