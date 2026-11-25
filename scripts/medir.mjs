/** Roda a medição de desempenho e imprime o resultado. Uso: node scripts/medir.mjs */
import { medirDesempenho } from '../src/desempenho.mjs';

const base = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const r = await medirDesempenho(base, 5);
console.log(JSON.stringify(r, null, 1));
