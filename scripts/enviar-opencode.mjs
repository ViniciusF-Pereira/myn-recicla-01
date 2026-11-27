/** Envia um texto para esta sessão do OpenCode. Uso: node scripts/enviar-opencode.mjs "mensagem" */
import { conversarNoOpenCode } from '../src/opencode-ponte.mjs';

const texto = process.argv.slice(2).join(' ').trim();
if (!texto) throw new Error('informe a mensagem');
const r = await conversarNoOpenCode(texto);
console.log(JSON.stringify({ ok: true, sessionID: r.sessionID, messageID: r.messageID, resposta: r.texto }, null, 2));
