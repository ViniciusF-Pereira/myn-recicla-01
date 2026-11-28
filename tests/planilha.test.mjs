import test from 'node:test';
import assert from 'node:assert/strict';
import { conteudoPlanilha } from '../web/tools/planilha.mjs';

test('planilha Wi-Fi é modelo local com colunas de alerta', () => {
  const d = conteudoPlanilha('me gera uma planilha de alertas de sinais de wifi publicos');
  assert.equal(d.nome, 'alertas-sinais-wifi-publicos.csv');
  assert.deepEqual(d.colunas.slice(0, 4), ['Data/Hora', 'SSID', 'BSSID', 'Sinal (dBm)']);
  assert.equal(d.linhas.length, 2);
  assert.ok(d.linhas.every((linha) => linha[0].startsWith('EXEMPLO')));
  assert.match(d.aviso, /navegador não varre redes Wi-Fi/);
});

test('CSV genérico tem BOM, separador e aviso honesto', () => {
  const d = conteudoPlanilha('criar planilha de tarefas');
  assert.equal(d.nome, 'criar-planilha-de-tarefas.csv');
  assert.ok(d.csv.startsWith('\ufeffItem;Categoria;Valor;Data;Observação;Status'));
  assert.match(d.csv, /EXEMPLO — substitua/);
  assert.match(d.aviso, /sem provedor externo/);
});

test('nome de arquivo remove acentos e caracteres inseguros', () => {
  const d = conteudoPlanilha('Ação: relatório / abril!');
  assert.equal(d.nome, 'acao-relatorio-abril.csv');
  assert.ok(!/[<>:"/\\|?*]/.test(d.nome));
});
