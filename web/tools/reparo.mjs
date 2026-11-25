/** Reparo puro de tool-call escrita como texto. Nada é executado; só parse validado. */
const PERMITIDAS = new Set(['write_file', 'read_file', 'list_files', 'nota', 'resultado']);

export function reparar(texto) {
  const s = String(texto || '');
  const json = /\{[^{}]*"tool"[^{}]*\}/.exec(s);
  if (json) {
    try {
      const o = JSON.parse(json[0]);
      if (PERMITIDAS.has(o.tool)) return { tool: o.tool, args: o.args || {} };
    } catch { /* segue para o formato linha */ }
  }
  const m = /\bTOOL\s+(\w+)\s+path=([^\s]+)(?:\s+content=([\s\S]*))?/i.exec(s);
  if (m && PERMITIDAS.has(m[1])) {
    return { tool: m[1], args: { path: m[2], ...(m[3] !== undefined ? { content: m[3] } : {}) } };
  }
  if (/^DONE[.!]?$/im.test(s.trim())) return { acao: 'DONE' };
  const final = /^FINAL\s+([\s\S]+)$/im.exec(s);
  if (final) return { acao: 'FINAL', texto: final[1] };
  return null;
}

export function seguro(path) {
  return String(path || 'nota').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '').slice(0, 80) || 'nota';
}
