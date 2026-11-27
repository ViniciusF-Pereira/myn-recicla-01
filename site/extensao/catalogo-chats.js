/** Catálogo de descoberta. Verificação de alcance em 27/11/2026; não é prova de automação. */
export const CATALOGO_CHATS = [
  { id: 'chatgpt-web', nome: 'ChatGPT', url: 'https://chatgpt.com/', origem: 'https://chatgpt.com', categoria: 'assistente', verificacao: 'rota-interna' },
  { id: 'claude-web', nome: 'Claude', url: 'https://claude.ai/', origem: 'https://claude.ai', categoria: 'assistente', verificacao: 'rota-interna' },
  { id: 'huggingchat', nome: 'HuggingChat', url: 'https://huggingface.co/chat', origem: 'https://huggingface.co', categoria: 'open-source', verificacao: 'rota-interna' },
  { id: 'openrouter-free', nome: 'OpenRouter', url: 'https://openrouter.ai/chat', origem: 'https://openrouter.ai', categoria: 'multi-modelo', verificacao: 'rota-interna' },
  { id: 'zai', nome: 'Z.ai / GLM', url: 'https://chat.z.ai/', origem: 'https://chat.z.ai', categoria: 'assistente', verificacao: 'rota-interna' },
  { id: 'perplexity-web', nome: 'Perplexity', url: 'https://www.perplexity.ai/', origem: 'https://www.perplexity.ai', categoria: 'busca', verificacao: 'http-200' },
  { id: 'copilot-web', nome: 'Microsoft Copilot', url: 'https://copilot.com/', origem: 'https://copilot.com', categoria: 'busca', verificacao: 'http-200' },
  { id: 'mistral-web', nome: 'Le Chat / Mistral', url: 'https://chat.mistral.ai/', origem: 'https://chat.mistral.ai', categoria: 'assistente', verificacao: 'protegido-403' },
  { id: 'grok-web', nome: 'Grok', url: 'https://grok.com/', origem: 'https://grok.com', categoria: 'assistente', verificacao: 'http-200' },
  { id: 'deepseek-web', nome: 'DeepSeek', url: 'https://chat.deepseek.com/', origem: 'https://chat.deepseek.com', categoria: 'assistente', verificacao: 'protegido-403' },
  { id: 'qwen-web', nome: 'Qwen', url: 'https://chat.qwen.ai/', origem: 'https://chat.qwen.ai', categoria: 'assistente', verificacao: 'http-200' },
  { id: 'meta-web', nome: 'Meta AI', url: 'https://www.meta.ai/', origem: 'https://www.meta.ai', categoria: 'assistente', verificacao: 'protegido-403' },
  { id: 'pi-web', nome: 'Pi', url: 'https://pi.ai/', origem: 'https://pi.ai', categoria: 'assistente', verificacao: 'protegido-403' },
  { id: 'poe-web', nome: 'Poe', url: 'https://poe.com/', origem: 'https://poe.com', categoria: 'multi-modelo', verificacao: 'login-403' },
  { id: 'you-web', nome: 'You.com', url: 'https://you.com/', origem: 'https://you.com', categoria: 'busca', verificacao: 'http-200' },
  { id: 'duck-web', nome: 'DuckDuckGo AI Chat', url: 'https://duck.ai/', origem: 'https://duck.ai', categoria: 'busca', verificacao: 'http-200' },
  { id: 'blackbox-web', nome: 'Blackbox AI', url: 'https://www.blackbox.ai/', origem: 'https://www.blackbox.ai', categoria: 'código', verificacao: 'http-200' },
  { id: 't3-web', nome: 'T3 Chat', url: 'https://www.t3.chat/', origem: 'https://www.t3.chat', categoria: 'multi-modelo', verificacao: 'limitado-429' },
  { id: 'brave-web', nome: 'Brave Leo', url: 'https://search.brave.com/chat', origem: 'https://search.brave.com', categoria: 'busca', verificacao: 'limitado-429' },
  { id: 'ecosia-web', nome: 'Ecosia AI Chat', url: 'https://www.ecosia.org/ai-chat', origem: 'https://www.ecosia.org', categoria: 'busca', verificacao: 'protegido-403' },
  { id: 'phind-web', nome: 'Phind', url: 'https://www.phind.com/', origem: 'https://www.phind.com', categoria: 'código', verificacao: 'protegido-403' },
  { id: 'writesonic-web', nome: 'Writesonic Chat', url: 'https://writesonic.com/chat', origem: 'https://writesonic.com', categoria: 'assistente', verificacao: 'http-200' },
  { id: 'hix-web', nome: 'HIX Chat', url: 'https://hix.ai/', origem: 'https://hix.ai', categoria: 'multi-modelo', verificacao: 'http-200' },
];

export function chatPorReferencia(valor) {
  const termo = String(valor || '').trim().toLowerCase();
  if (!termo) return null;
  return CATALOGO_CHATS.find((c) => c.id === termo || c.nome.toLowerCase() === termo || c.origem.replace('https://', '') === termo) || null;
}
