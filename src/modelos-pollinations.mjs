/** IDs canônicos do Pollinations, vindos da descoberta; sem duplicatas e sem Google/Gemini. */
import { readFile } from 'node:fs/promises';

let modelos = ['openai-fast'];
try {
  const dados = JSON.parse(await readFile(new URL('../config/modelos-descobertos.json', import.meta.url), 'utf8'));
  const ids = (dados.modelos || [])
    .filter((m) => m.fonte === 'pollinations' && !/google|gemini/i.test(m.id))
    .map((m) => m.id)
    .filter(Boolean);
  if (ids.length) modelos = [...new Set(ids)];
} catch { /* fallback mínimo */ }

export const MODELOS_POLLINATIONS = modelos;
