import { readdir, rm } from 'node:fs/promises';
import path from 'node:path';
export async function limparTemp(){
 const r=[];for(const b of ['dados/arquivos','.playground-workspace']){let ns=[];try{ns=await readdir(b)}catch{continue}for(const n of ns.filter(x=>/^(tmp-|paleta-)/.test(x))){try{await rm(path.join(b,n),{force:true,recursive:true});r.push(n)}catch{}}}return r}
console.log(JSON.stringify({removidos:await limparTemp()}));

