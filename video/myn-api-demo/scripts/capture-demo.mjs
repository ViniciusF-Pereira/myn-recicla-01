import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.MYN_DADOS = path.resolve(RAIZ, '../../dados');
const { gerarImagem, gerarAudio } = await import('../../../src/midia.mjs');
const BASE = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const assets = path.join(RAIZ, 'assets');
await mkdir(path.join(assets, 'images'), { recursive: true });
await mkdir(path.join(assets, 'audio'), { recursive: true });
await mkdir(path.join(assets, 'data'), { recursive: true });

async function json(url, options = {}) {
  const r = await fetch(BASE + url, { ...options, signal: AbortSignal.timeout(180000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(url + ' HTTP ' + r.status + ': ' + (data.error || data.message || 'erro'));
  return data;
}
async function baixar(url, destino) {
  const r = await fetch(BASE + url, { signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error('download HTTP ' + r.status);
  await writeFile(destino, Buffer.from(await r.arrayBuffer()));
}

const token = (await json('/api/token')).token;
const criada = await json('/api/admin/chaves', {
  method: 'POST',
  headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
  body: JSON.stringify({ nome: 'Demo vídeo Myn', plano: 'pro' }),
});
const chave = criada.chave;
if (!chave) throw new Error('resposta sem chave');
try {
  const prompt = 'Explique o Myn em uma frase.';
  const resposta = await json('/v1/agent', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + chave, 'content-type': 'application/json' },
    body: JSON.stringify({ message: prompt, session: 'demo-video', effort: 'medium', rota: 'auto' }),
  });
  const uso = await json('/v1/usage', { headers: { authorization: 'Bearer ' + chave } });
  const respostaPublica = { ...resposta, sessao: 'api:••••:demo-video' };
  await writeFile(path.join(assets, 'data', 'api-response.json'), JSON.stringify(respostaPublica, null, 2));
  await writeFile(path.join(assets, 'data', 'api-usage.json'), JSON.stringify(uso, null, 2));

  const imagem = await gerarImagem('Abstract folded paper clouds, blue geometric circles, cream paper texture, editorial technology collage, no humans, no faces, no eyes, no text, no logos, wide 16:9', 1280, 720);
  await baixar(imagem.url, path.join(assets, 'images', 'myn-campaign.jpg'));

  const prova = await gerarAudio('Pede voz. O mesmo agente entrega a narração.', 'pt-BR-FranciscaNeural');
  await baixar(prova.url, path.join(assets, 'audio', 'prova-voz.mp3'));

  const narracao = [
    'Se você tem uma aba, você tem um agente.',
    'Eu sou o WORK. Conheço as rotas, os limites e o caminho até o resultado.',
    'Uma chamada à API já conversa, lembra do contexto e escolhe a rota.',
    'Você pede uma resposta. Recebe texto pronto para usar.',
    'Pede uma imagem. Ela é gerada sem chave.',
    'Pede voz. O mesmo agente entrega a narração.',
    'Myn Recicla. Sua aba vira agente.',
  ].join(' ');
  const voz = await gerarAudio(narracao, 'pt-BR-FranciscaNeural');
  await baixar(voz.url, path.join(assets, 'audio', 'narracao-work.mp3'));

  await writeFile(path.join(assets, 'data', 'provenance.json'), JSON.stringify({
    capturedAt: new Date().toISOString(),
    api: { endpoint: '/v1/agent', status: 200, session: 'demo-video', request: { message: prompt, effort: 'medium', rota: 'auto' } },
    image: { fonte: imagem.fonte, prompt: imagem.prompt },
    audio: { fonte: prova.fonte, voz: prova.voz },
    narration: { fonte: voz.fonte, voz: voz.voz },
    secretStored: false,
  }, null, 2));
  console.log(JSON.stringify({ ok: true, resposta: resposta.resposta?.slice(0, 160), via: resposta.via, uso: uso.usado, limite: uso.limite }));
} finally {
  const r = await fetch(BASE + '/api/admin/chaves/' + criada.id, { method: 'DELETE', headers: { authorization: 'Bearer ' + token } });
  if (!r.ok) throw new Error('falha ao revogar chave demo: HTTP ' + r.status);
  console.log(JSON.stringify({ ok: true, chaveDemoRevogada: true }));
}
