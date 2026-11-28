/** Planilhas locais no navegador: CSV com BOM, sem gateway, chave ou rede. */
const CAMPOS_WIFI = ['Data/Hora', 'SSID', 'BSSID', 'Sinal (dBm)', 'Segurança', 'Canal', 'Largura (MHz)', 'Observação', 'Status'];
const EXEMPLOS_WIFI = [
  ['EXEMPLO — substitua', 'Rede Pública A', '00:11:22:33:44:55', '-62', 'WPA2', '6', '80', 'Sinal bom para uso pontual', 'Observar'],
  ['EXEMPLO — substitua', 'Rede Pública B', '66:77:88:99:AA:BB', '-78', 'Aberto', '11', '20', 'Sinal fraco; evitar transferência de arquivos', 'Atenção'],
];

function celula(valor) {
  const texto = String(valor ?? '');
  return /[";\r\n]/.test(texto) ? '"' + texto.replace(/"/g, '""') + '"' : texto;
}

function csv(colunas, linhas) {
  return '\ufeff' + [colunas, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n') + '\r\n';
}

function nomeArquivo(pedido) {
  const base = String(pedido || 'planilha')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
  return (base || 'planilha') + '.csv';
}

export function conteudoPlanilha(pedido = '') {
  const texto = String(pedido || '').trim();
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/wifi|wi-fi|sem fio|wireless|ssid|bssid/.test(t)) {
    return {
      nome: nomeArquivo('alertas-sinais-wifi-publicos'),
      colunas: CAMPOS_WIFI,
      linhas: EXEMPLOS_WIFI.map((linha) => [...linha]),
      csv: csv(CAMPOS_WIFI, EXEMPLOS_WIFI),
      aviso: 'Modelo local. O navegador não varre redes Wi-Fi; substitua os exemplos por medições reais. Não use a planilha para contornar redes privadas.',
    };
  }
  const colunas = ['Item', 'Categoria', 'Valor', 'Data', 'Observação', 'Status'];
  const linhas = [['EXEMPLO — substitua', 'Geral', '', '', 'Preencha com seus dados', 'Pendente']];
  return {
    nome: nomeArquivo(texto),
    colunas,
    linhas,
    csv: csv(colunas, linhas),
    aviso: 'CSV local gerado sem provedor externo. Abra no Excel, LibreOffice ou Google Planilhas e substitua a linha de exemplo.',
  };
}

export function gerarPlanilha(pedido = '') {
  const dados = conteudoPlanilha(pedido);
  const blob = new Blob([dados.csv], { type: 'text/csv;charset=utf-8' });
  return { ...dados, tipo: 'planilha', url: URL.createObjectURL(blob), fonte: 'gerador local · CSV · sem rede' };
}
