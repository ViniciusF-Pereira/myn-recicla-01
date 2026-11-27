/** Ponte site ↔ extensão. O site nunca recebe token ou acesso irrestrito ao navegador. */
(() => {
  const CANAL = 'myn-recicla-extensao';
  const autorizado = location.hostname === 'mynrecicla.com'
    || (location.hostname === '127.0.0.1' && location.port === '5188');

  if (!autorizado || window.__mynExtensaoPonte) return;
  window.__mynExtensaoPonte = true;
  document.documentElement.dataset.mynExtensao = chrome.runtime.getManifest().version;

  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const dados = event.data;
    if (!dados || dados.canal !== CANAL || !dados.id || !dados.tipo) return;
    try {
      const resposta = await chrome.runtime.sendMessage({ ...dados, origemPagina: location.origin });
      window.postMessage({ canal: CANAL, id: dados.id, ok: true, resposta }, location.origin);
    } catch (erro) {
      window.postMessage({ canal: CANAL, id: dados.id, ok: false, erro: String(erro?.message || erro) }, location.origin);
    }
  });

  window.postMessage({ canal: CANAL, tipo: 'extensao_presente', versao: chrome.runtime.getManifest().version }, location.origin);
})();
