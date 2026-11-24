/** Reparo determinístico de tool calls em texto (sem modelo extra: o Myn-Portable só tem rota Browser). */

function dentroDeString(texto, i) {
  let aspas = null;
  for (let at = 0; at < i; at++) {
    const ch = texto[at];
    if (aspas) {
      if (ch === '\\') at++;
      else if (ch === aspas) aspas = null;
    } else if (ch === '"' || ch === "'") aspas = ch;
  }
  return aspas !== null;
}

function objetosBalanceados(texto) {
  const saida = [];
  for (let i = 0; i < texto.length; i++) {
    if (texto[i] !== '{' || dentroDeString(texto, i)) continue;
    let depth = 0, aspas = null;
    for (let at = i; at < texto.length; at++) {
      const ch = texto[at];
      if (aspas) {
        if (ch === '\\') at++;
        else if (ch === aspas) aspas = null;
        continue;
      }
      if (ch === '"' || ch === "'") { aspas = ch; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) { saida.push(texto.slice(i, at + 1)); i = at; break; }
      }
    }
  }
  return saida;
}

function normalizar(texto) {
  return texto
    .replace(/```(?:json)?/gi, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/'([^'\\]*)'/g, '"$1"');
}

/** Reconhece TOOL nome caminho=... conteudo=... ou JSON {tool_call:{...}}. */
export function repararComando(texto, permitidos) {
  const permitido = permitidos instanceof Set ? permitidos : new Set(permitidos);
  const linha = /TOOL\s+(write_file|read_file|list_files|run_tests)\s+path=([A-Za-z0-9_.-]+)(?:\s+content=([^\r\n]{1,160}))?/i.exec(texto);
  if (linha) {
    return {
      tool: linha[1].toLowerCase(),
      args: { path: linha[2].replace(/\.[a-z]+$/i, ''), ...(linha[3] ? { content: linha[3] } : {}) },
    };
  }
  for (const objeto of objetosBalanceados(texto)) {
    try {
      const v = JSON.parse(normalizar(objeto));
      const chamada = v.tool_call ?? v.function ?? v;
      const nome = typeof chamada.name === 'string' ? chamada.name.toLowerCase() : '';
      if (!permitido.has(nome)) continue;
      let args = chamada.arguments;
      if (typeof args === 'string') args = JSON.parse(normalizar(args));
      if (args && typeof args === 'object') return { tool: nome, args };
    } catch { /* próximo objeto */ }
  }
  return null;
}

export function extrairResposta(texto, prompt, rodape = ['Baixar app', 'Fazer upgrade', '\nAuto', '\nNew', 'Connect IM']) {
  const idx = texto.lastIndexOf(prompt);
  if (idx < 0) return '';
  let resto = texto.slice(idx + prompt.length);
  const cortes = rodape.map((m) => resto.indexOf(m)).filter((p) => p >= 0);
  if (cortes.length) resto = resto.slice(0, Math.min(...cortes));
  return resto.replace(/^["'\s]+|["'\s]+$/g, '');
}
