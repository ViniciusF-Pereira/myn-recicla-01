import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.MYN_DADOS = path.resolve(RAIZ, '../../dados');
const { gerarAudio } = await import('../../../src/midia.mjs');
const dir = path.join(RAIZ, 'assets', 'audio');
await mkdir(dir, { recursive: true });
const lines = [
  'Trinta e dois chats mapeáveis. E um agente que sabe o caminho.',
  'Eu sou o WORK. Conheço as rotas, os limites e o caminho até o resultado.',
  'Uma chamada à API já conversa, lembra do contexto e escolhe a rota.',
  'Você pede uma resposta. Recebe texto pronto para usar.',
  'Pede uma imagem. Ela é gerada sem chave.',
  'Pede voz. O mesmo agente entrega a narração.',
  'Myn Recicla. Sua aba vira agente.',
];
for (let i = 0; i < lines.length; i++) {
  const r = await gerarAudio(lines[i], 'pt-BR-FranciscaNeural');
  const bytes = await fetch('http://127.0.0.1:5188' + r.url).then((x) => x.arrayBuffer());
  await writeFile(path.join(dir, 'voz-' + (i + 1) + '.mp3'), Buffer.from(bytes));
  console.log(JSON.stringify({ linha: i + 1, arquivo: 'voz-' + (i + 1) + '.mp3' }));
}
