/** Roda os casos de qualidade do agente. Uso: node scripts/avaliar-qualidade.mjs */
import { rodarAvaliacao } from '../src/avaliacao-qualidade.mjs';
console.log(JSON.stringify(await rodarAvaliacao(), null, 2));
