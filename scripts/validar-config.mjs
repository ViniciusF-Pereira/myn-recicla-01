import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
export async function validarConfig(){const erros=[];for(const n of await readdir('config')){if(!n.endsWith('.json'))continue;try{JSON.parse(await readFile(path.join('config',n),'utf8'))}catch(e){erros.push(n)}}return {ok:erros.length===0,erros}}
console.log(JSON.stringify(await validarConfig()));

