/** Token local para agentes que conectam por HTTP/MCP. Nunca vai para o Git. */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DADOS = process.env.MYN_DADOS || path.join(process.cwd(), 'dados');
const ARQUIVO = path.join(DADOS, 'token-local.json');

export async function emitirToken({ renovar = false, ttlMs = 30 * 24 * 60 * 60 * 1000 } = {}) {
  await mkdir(DADOS, { recursive: true });
  if (!renovar) {
    try {
      const atual = JSON.parse(await readFile(ARQUIVO, 'utf8'));
      if (atual.token && atual.expiresAt > Date.now()) return atual;
    } catch { /* cria novo */ }
  }
  const dados = { token: randomBytes(32).toString('base64url'), createdAt: Date.now(), expiresAt: Date.now() + ttlMs, scope: 'agente-local' };
  await writeFile(ARQUIVO, JSON.stringify(dados, null, 2) + '\n', { mode: 0o600 });
  return dados;
}

export async function validarToken(token) {
  if (!token) return false;
  try {
    const dados = JSON.parse(await readFile(ARQUIVO, 'utf8'));
    const a = Buffer.from(String(token)), b = Buffer.from(String(dados.token || ''));
    return a.length === b.length && timingSafeEqual(a, b) && dados.expiresAt > Date.now();
  } catch { return false; }
}

export function bearer(req) {
  const h = String(req.headers?.authorization || '');
  return /^Bearer\s+(.+)$/i.exec(h)?.[1] || '';
}

export function ehLoopback(req) {
  const ip = String(req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  return ip === '127.0.0.1' || ip === '::1';
}
