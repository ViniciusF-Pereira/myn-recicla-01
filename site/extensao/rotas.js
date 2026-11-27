/** Adaptadores versionados. O acesso é opcional e por origem. */
export const VERSAO_ADAPTADORES = 2;
export const ROTAS = [
  {
    id: 'myn-teste-local', nome: 'Myn · teste local', url: 'http://127.0.0.1:5188/extensao/teste.html',
    origem: 'http://127.0.0.1:5188', oculta: true, versao: 1,
    campos: ['#mensagem'], envio: ['button[type="submit"]'], respostas: ['#resposta'],
  },
  {
    id: 'chatgpt-web', nome: 'ChatGPT Web', url: 'https://chatgpt.com/', origem: 'https://chatgpt.com', versao: 2,
    campos: ['#prompt-textarea', 'textarea[placeholder*="Message" i]', 'div[contenteditable="true"]'],
    envio: ['button[data-testid="send-button"]', 'button[aria-label*="Send" i]'],
    respostas: ['[data-message-author-role="assistant"]', '[data-testid="conversation-turn"]', 'article [data-message-author-role]'],
    login: ['a[href*="/auth/login"]'],
  },
  {
    id: 'claude-web', nome: 'Claude Web', url: 'https://claude.ai/', origem: 'https://claude.ai', versao: 2,
    campos: ['div[contenteditable="true"]', 'textarea[placeholder*="Reply" i]'],
    envio: ['button[aria-label*="Send" i]', 'button[data-testid="send-button"]'],
    respostas: ['.font-claude-response', '[data-is-streaming]', '[data-testid="assistant-message"]'],
    login: ['a[href*="/login"]'],
  },
  {
    id: 'huggingchat', nome: 'HuggingChat', url: 'https://huggingface.co/chat', origem: 'https://huggingface.co', versao: 2,
    campos: ['textarea[placeholder]', 'textarea'],
    envio: ['button[type="submit"]', 'button[aria-label*="Send" i]'],
    respostas: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]', '.prose'],
    login: ['a[href*="/login"]'],
  },
  {
    id: 'openrouter-free', nome: 'OpenRouter :free', url: 'https://openrouter.ai/chat', origem: 'https://openrouter.ai', versao: 1,
    campos: ['textarea', '[contenteditable="true"]'],
    envio: ['button[type="submit"]', 'button[aria-label*="Send" i]'],
    respostas: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]', '.prose'],
    login: ['a[href*="/login"]'],
  },
  {
    id: 'zai', nome: 'Z.ai / GLM', url: 'https://chat.z.ai/', origem: 'https://chat.z.ai', versao: 1,
    campos: ['textarea', '[contenteditable="true"]'],
    envio: ['button[type="submit"]', 'button[aria-label*="Send" i]'],
    respostas: ['[data-message-author-role="assistant"]', '[data-testid="assistant-message"]', '.prose'],
    login: ['a[href*="/login"]'],
  },
];

export function rotaPorId(id) { return ROTAS.find((r) => r.id === id) || null; }
