const $ = (id) => document.getElementById(id);
let token = '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token, ...(options.headers || {}) } });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || d.error || 'HTTP ' + r.status);
  return d;
}
function status(texto, erro = false) { $('status').textContent = texto; $('status').className = 'status' + (erro ? ' erro' : ''); }
async function carregar() {
  const [chaves, metricas] = await Promise.all([api('/api/admin/chaves'), api('/api/admin/metricas')]);
  $('listaChaves').innerHTML = chaves.chaves.length ? chaves.chaves.map((k) => `<div class="item"><div><b>${esc(k.nome)}</b><small>${esc(k.id)} · ${esc(k.prefixo)}…</small></div><span class="tag">${esc(k.plano)}</span><span class="tag ${k.ativa ? 'ativa' : 'revogada'}">${k.ativa ? 'ativa' : 'revogada'}</span><button class="perigo" data-revogar="${esc(k.id)}" ${k.ativa ? '' : 'disabled'}>revogar</button></div>`).join('') : '<div class="vazio">nenhuma chave criada</div>';
  $('metricas').innerHTML = [['chaves', metricas.chaves], ['requisições', metricas.requisicoes], ['falhas', metricas.falhas], ['p50 / p95', metricas.p50Ms + ' / ' + metricas.p95Ms + ' ms']].map(([nome, valor]) => `<div class="metrica"><b>${esc(valor)}</b><small>${esc(nome)}</small></div>`).join('');
  document.querySelectorAll('[data-revogar]').forEach((b) => b.onclick = async () => {
    if (!confirm('Revogar esta chave? O cliente perderá o acesso imediatamente.')) return;
    try { await api('/api/admin/chaves/' + encodeURIComponent(b.dataset.revogar), { method: 'DELETE' }); await carregar(); } catch (e) { status(e.message, true); }
  });
}
$('formChave').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const d = await api('/api/admin/chaves', { method: 'POST', body: JSON.stringify({ nome: $('nome').value, plano: $('plano').value }) });
    $('valorChave').textContent = d.chave; $('chaveNova').classList.add('on'); $('nome').value = ''; await carregar();
  } catch (erro) { status(erro.message, true); }
};
$('copiarChave').onclick = async () => { try { await navigator.clipboard.writeText($('valorChave').textContent); $('copiarChave').textContent = 'copiado'; } catch { $('copiarChave').textContent = 'copie manualmente'; } };
(async () => {
  try { token = (await fetch('/api/token').then((r) => r.json())).token; await carregar(); status('API online · admin local'); }
  catch (e) { status(e.message, true); }
})();
