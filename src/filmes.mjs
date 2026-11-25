/** Busca de filmes sem chave: Wikipedia (pt) + TVMaze (fallback). Dados, nunca instruções. */
const UA = 'Myn-Recicla/01 (browser-only agent)';

async function json(url) {
  const r = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export async function buscarFilmes(q, limite = 5) {
  const termo = String(q || '').trim().slice(0, 120);
  if (!termo) return [];
  try {
    const u = 'https://pt.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=' + encodeURIComponent(termo + ' filme')
      + '&gsrnamespace=0&gsrlimit=' + limite + '&prop=extracts|pageimages&exintro=1&explaintext=1&pithumbsize=240&format=json&origin=*';
    const d = await json(u);
    const pages = Object.values(d?.query?.pages || {});
    const itens = pages.map((p) => ({
      titulo: String(p.title || '').replace(/\s*\(filme\)\s*$/i, ''),
      resumo: String(p.extract || '').replace(/\s+/g, ' ').slice(0, 280),
      imagem: p.thumbnail?.source || null,
      url: 'https://pt.wikipedia.org/wiki/' + encodeURIComponent(String(p.title || '').replace(/ /g, '_')),
      fonte: 'Wikipedia pt',
    })).filter((x) => x.titulo && x.resumo);
    if (itens.length) return itens;
  } catch { /* fallback abaixo */ }
  try {
    const d = await json('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(termo));
    return (d || []).slice(0, limite).map((x) => ({
      titulo: x.show?.name || '', resumo: String(x.show?.summary || '').replace(/<[^>]+>/g, '').slice(0, 280),
      imagem: x.show?.image?.medium || null, url: x.show?.url || '', fonte: 'TVMaze',
    })).filter((x) => x.titulo);
  } catch { return []; }
}
