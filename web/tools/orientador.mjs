/** Roteamento determinístico de intenção para tools locais antes de chamar um modelo. */
export function orientarPedido(texto = '') {
  const t = String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/\b(planilha|spreadsheet|csv|xlsx)\b/.test(t)) {
    return { intencao: 'planilha', ferramentas: ['planilha_local'], explicacao: 'Gero um CSV local com preview e download; não preciso de gateway.' };
  }
  if (/\b(imagem|foto|desenho|ilustracao|retrato)\b/.test(t)) {
    return { intencao: 'imagem', ferramentas: ['estudio_imagem'], explicacao: 'Abro o Estúdio de imagem com estilo e formato.' };
  }
  if (/\b(video|clipe|animacao|gif)\b/.test(t)) {
    return { intencao: 'video', ferramentas: ['estudio_video'], explicacao: 'Abro o Estúdio de vídeo com duração e movimento.' };
  }
  if (/\b(audio|voz|narracao|narrar)\b/.test(t)) {
    return { intencao: 'audio', ferramentas: ['estudio_audio'], explicacao: 'Abro o Estúdio de áudio com narração no navegador.' };
  }
  if (/\b(pesquis\w*|fontes?|documenta\w*|compar\w*|referencias?)\b/.test(t)) {
    return { intencao: 'pesquisa', ferramentas: ['rag_local', 'catalogo_plugins'], explicacao: 'Pesquiso no RAG local e no catálogo antes de responder.' };
  }
  if (/\b(arquivo|documento|pdf|csv|txt|json)\b/.test(t)) {
    return { intencao: 'arquivo', ferramentas: ['arquivos_locais'], explicacao: 'Uso a camada de arquivos do navegador.' };
  }
  if (/\b(memoria|historico|caderno|lembr)\b/.test(t)) {
    return { intencao: 'memoria', ferramentas: ['memoria_local'], explicacao: 'Consulto a memória local da sessão.' };
  }
  if (/\b(rotas|plugins|modelos|saude|extensao)\b/.test(t)) {
    return { intencao: 'catalogo', ferramentas: ['catalogo_rotas'], explicacao: 'Consulto o catálogo e a saúde das rotas.' };
  }
  return { intencao: 'chat', ferramentas: ['chat'], explicacao: 'Respondo pela rota escolhida, com fallback no navegador.' };
}
