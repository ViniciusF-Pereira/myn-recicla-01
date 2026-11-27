import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mídia web não depende de Node ou binários locais', async () => {
  const codigo = await readFile('web/midia/navegador.mjs', 'utf8');
  assert.ok(!/child_process|node:fs|python|ffmpeg|tesseract\.exe/i.test(codigo));
  assert.match(codigo, /MediaRecorder/);
  assert.match(codigo, /SpeechSynthesis/);
  assert.match(codigo, /Canvas/);
});

test('interface usa a camada de mídia do navegador', async () => {
  const app = await readFile('site/app.mjs', 'utf8');
  const play = await readFile('site/playground.js', 'utf8');
  const html = await readFile('site/playground.html', 'utf8');
  assert.match(app, /midia:/);
  assert.match(play, /window\.myn\?\.midia/);
  assert.match(html, /id="effort"/);
  assert.match(play, /&effort=/);
});
