/** Rotas de aba suportadas pela extensão. O acesso é opcional e por origem. */
export const ROTAS = [
  {
    id: 'myn-teste-local', nome: 'Myn · teste local', url: 'http://127.0.0.1:5188/extensao/teste.html',
    origem: 'http://127.0.0.1:5188', oculta: true,
    seletor: '#mensagem', resposta: '#resposta',
  },
  {
    id: 'chatgpt-web', nome: 'ChatGPT Web', url: 'https://chatgpt.com/',
    origem: 'https://chatgpt.com',
    seletor: '#prompt-textarea, textarea[placeholder*="Message"], div[contenteditable="true"]',
    resposta: '[data-message-author-role="assistant"], [data-testid*="conversation-turn"]',
  },
  {
    id: 'claude-web', nome: 'Claude Web', url: 'https://claude.ai/',
    origem: 'https://claude.ai',
    seletor: 'div[contenteditable="true"], textarea',
    resposta: '[data-is-streaming], .font-claude-response, [data-testid*="assistant"]',
  },
  {
    id: 'huggingchat', nome: 'HuggingChat', url: 'https://huggingface.co/chat',
    origem: 'https://huggingface.co',
    seletor: 'textarea[placeholder], textarea',
    resposta: '[data-message-author-role="assistant"], [data-testid*="assistant"]',
  },
  {
    id: 'openrouter-free', nome: 'OpenRouter :free', url: 'https://openrouter.ai/chat',
    origem: 'https://openrouter.ai',
    seletor: 'textarea, [contenteditable="true"]',
    resposta: '[data-message-author-role="assistant"], [data-testid*="assistant"]',
  },
  {
    id: 'zai', nome: 'Z.ai / GLM', url: 'https://chat.z.ai/',
    origem: 'https://chat.z.ai',
    seletor: 'textarea, [contenteditable="true"]',
    resposta: '[data-message-author-role="assistant"], [data-testid*="assistant"]',
  },
];

export function rotaPorId(id) {
  return ROTAS.find((r) => r.id === id) || null;
}
