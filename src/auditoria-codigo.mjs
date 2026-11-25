/** Auditoria determinística de código: cada achado tem um teste que reproduz e, quando possível, um patch mínimo. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const RAIZ = process.cwd();
async function texto(arquivo) {
  try { return await readFile(path.join(RAIZ, arquivo), 'utf8'); } catch { return ''; }
}

function achado(id, arquivo, descricao, teste, correcao = null) {
  const correcoes = Array.isArray(correcao) ? correcao : correcao ? [correcao] : [];
  return { id, arquivo, categoria: /midia/.test(arquivo) ? 'infra' : 'codigo', descricao, teste, correcao: correcoes.length ? correcoes : null };
}

export async function auditarCodigo() {
  const findings = [];
  const midia = await texto('src/midia.mjs');
  if (midia.includes('if (!alvo.startsWith(DIR_ARQUIVOS))')) {
    findings.push(achado('midia-path-traversal', 'src/midia.mjs',
      'startsWith permite prefixo de diretório irmão; usar path.relative para confinar o arquivo.',
      async () => (await texto('src/midia.mjs')).includes('if (!alvo.startsWith(DIR_ARQUIVOS))'),
      { antigo: "  if (!alvo.startsWith(DIR_ARQUIVOS)) throw new Error('fora do diretorio');",
        novo: "  const rel = path.relative(DIR_ARQUIVOS, alvo);\n  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('fora do diretorio');" }));
  }

  for (const arquivo of ['src/midia.mjs', 'src/gateway.mjs', 'scripts/mapear.mjs']) {
    const codigo = await texto(arquivo);
    if (!codigo || !codigo.includes('C:/Program Files/Tesseract-OCR/tesseract.exe')) continue;
    const antigo = arquivo === 'src/midia.mjs'
      ? "const TESSERACT = 'C:/Program Files/Tesseract-OCR/tesseract.exe';"
      : "const TESSERACT = process.env.MYNCELLIUM_TESSERACT || 'C:/Program Files/Tesseract-OCR/tesseract.exe';";
    const novo = arquivo === 'src/midia.mjs'
      ? "const TESSERACT = process.env.MYN_TESSERACT || 'tesseract';"
      : "const TESSERACT = process.env.MYN_TESSERACT || process.env.MYNCELLIUM_TESSERACT || 'tesseract';";
    findings.push(achado('tesseract-portavel-' + arquivo.replace(/[^a-z]+/gi, '-'), arquivo,
      'Tesseract preso a caminho Windows; usar PATH no Linux/Docker e permitir override.',
      async () => (await texto(arquivo)).includes('C:/Program Files/Tesseract-OCR/tesseract.exe'),
      { antigo, novo }));
  }

  const worker = await texto('src/worker.mjs');
  if (worker.includes("await git(['add', '-A']);")) {
    findings.push(achado('worker-escopo-commit', 'src/worker.mjs',
      'git add -A pode commitar mudanças alheias; limitar add e commit ao arquivo da tarefa.',
      async () => (await texto('src/worker.mjs')).includes("await git(['add', '-A']);"),
      [
        { antigo: "async function commitEmerge(mensagem) {", novo: "async function commitEmerge(mensagem, arquivo) {" },
        { antigo: "  await git(['add', '-A']);", novo: "  await git(['add', '--', arquivo]);" },
        { antigo: "  await git(['commit', '-m', mensagem]);", novo: "  await git(['commit', '-m', mensagem, '--', arquivo]);" },
        { antigo: "const merge = autoMerge ? await commitEmerge('worker: ' + t.titulo + ' (ciclo ' + n + ')')", novo: "const merge = autoMerge ? await commitEmerge('worker: ' + t.titulo + ' (ciclo ' + n + ')', t.alvo)" },
      ]));
  }

  for (const arquivo of ['src/stream.mjs', 'src/rapido.mjs']) {
    const codigo = await texto(arquivo);
    if (/gemini|google/i.test(codigo)) findings.push(achado('sem-google-' + arquivo, arquivo,
      'caminho de execução contém Google/Gemini.', async () => /gemini|google/i.test(await texto(arquivo))));
  }

  return {
    quando: new Date().toISOString(),
    achados: findings,
    resumo: { total: findings.length, deterministicos: findings.filter((f) => f.correcao).length, llm: findings.filter((f) => !f.correcao).length },
  };
}

export async function reproduzirAchado(id) {
  const auditoria = await auditarCodigo();
  const f = auditoria.achados.find((x) => x.id === id);
  return f ? Boolean(await f.teste()) : false;
}
