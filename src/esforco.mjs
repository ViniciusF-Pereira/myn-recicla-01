/** Níveis de esforço do agente: profundidade, orçamento de rotas e tamanho do RAG. */
export const ESFORCOS = {
  low: { plano: false, rotas: 1, rag: 3000 },
  medium: { plano: false, rotas: 2, rag: 5000 },
  high: { plano: true, rotas: 3, rag: 8000 },
};

export function normalizarEffort(valor) {
  const e = String(valor || 'medium').trim().toLowerCase();
  return ESFORCOS[e] ? e : 'medium';
}
