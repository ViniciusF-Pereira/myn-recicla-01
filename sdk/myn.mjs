/** SDK oficial não oficial do Myn, sem dependências. Node 20+ e navegador moderno. */
export class Myn {
  constructor({ baseUrl = 'http://127.0.0.1:5188', apiKey, fetchImpl = fetch, timeoutMs = 180000 } = {}) {
    if (!apiKey) throw new Error('MYN_API_KEY obrigatória');
    this.baseUrl = String(baseUrl).replace(/\/$/, '');
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.timeoutMs = timeoutMs;
  }
  async request(path, { method = 'GET', body, signal } = {}) {
    const r = await this.fetch(this.baseUrl + path, {
      method,
      headers: { authorization: 'Bearer ' + this.apiKey, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal || AbortSignal.timeout(this.timeoutMs),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(d.error?.message || 'HTTP ' + r.status);
      e.status = r.status; e.code = d.error?.type || 'api_error'; e.data = d;
      throw e;
    }
    return d;
  }
  agent({ message, session = 'default', route = 'auto', effort = 'medium', plan = false, signal } = {}) {
    return this.request('/v1/agent', { method: 'POST', signal, body: { message, session, route, effort, planejar: plan } });
  }
  usage(limit = 50) { return this.request('/v1/usage?limit=' + Math.min(200, Math.max(1, Number(limit) || 50))); }
}

export default Myn;
