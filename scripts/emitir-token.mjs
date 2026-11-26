/** Mostra o token local e os endpoints para conectar um agente por HTTP/MCP. */
const base = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const r = await fetch(base + '/api/token');
if (!r.ok) throw new Error('não foi possível emitir token: HTTP ' + r.status);
const d = await r.json();
console.log(JSON.stringify({
  ...d,
  observacao: 'Token local. Não commite, não compartilhe e não publique esta saída.',
  ExemploMCP: {
    mcpServers: {
      'myn-recicla': { url: d.mcpUrl, headers: { Authorization: 'Bearer ' + d.token } },
    },
  },
}, null, 2));
