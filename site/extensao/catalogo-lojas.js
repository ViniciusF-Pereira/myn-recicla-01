/** Lojas conhecidas para descoberta de busca, produtos e navegação. */
export const LOJAS_CONHECIDAS = [
  { id: 'americanas', nome: 'Americanas', url: 'https://www.americanas.com.br/', origem: 'https://www.americanas.com.br' },
  { id: 'magalu', nome: 'Magazine Luiza', url: 'https://www.magazineluiza.com.br/', origem: 'https://www.magazineluiza.com.br' },
  { id: 'casasbahia', nome: 'Casas Bahia', url: 'https://www.casasbahia.com.br/', origem: 'https://www.casasbahia.com.br' },
  { id: 'renner', nome: 'Lojas Renner', url: 'https://www.lojasrenner.com.br/', origem: 'https://www.lojasrenner.com.br' },
  { id: 'mercadolivre', nome: 'Mercado Livre', url: 'https://www.mercadolivre.com.br/', origem: 'https://www.mercadolivre.com.br' },
  { id: 'shopee', nome: 'Shopee', url: 'https://www.shopee.com.br/', origem: 'https://www.shopee.com.br' },
  { id: 'amazon-br', nome: 'Amazon Brasil', url: 'https://www.amazon.com.br/', origem: 'https://www.amazon.com.br' },
  { id: 'submarino', nome: 'Submarino', url: 'https://www.submarino.com.br/', origem: 'https://www.submarino.com.br' },
  { id: 'extra', nome: 'Extra', url: 'https://www.extra.com.br/', origem: 'https://www.extra.com.br' },
  { id: 'pontofrio', nome: 'Ponto Frio', url: 'https://www.pontofrio.com.br/', origem: 'https://www.pontofrio.com.br' },
  { id: 'centauro', nome: 'Centauro', url: 'https://www.centauro.com.br/', origem: 'https://www.centauro.com.br' },
  { id: 'netshoes', nome: 'Netshoes', url: 'https://www.netshoes.com.br/', origem: 'https://www.netshoes.com.br' },
  { id: 'myn-loja-teste', nome: 'Myn · loja de teste', url: 'http://127.0.0.1:5188/extensao/loja-teste.html', origem: 'http://127.0.0.1:5188', oculta: true },
];

export function lojaPorReferencia(valor) {
  const termo = String(valor || '').trim().toLowerCase();
  return LOJAS_CONHECIDAS.find((l) => l.id === termo || l.nome.toLowerCase() === termo || l.origem === termo) || null;
}
