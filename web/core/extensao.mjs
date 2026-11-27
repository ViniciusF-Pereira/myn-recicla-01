/** Ponte de página para a extensão Manifest V3. Sem token e sem acesso irrestrito. */
const CANAL = 'myn-recicla-extensao';
const pendentes = new Map();
let seq = 0;
let presenca = null;
const depura = [];

function podeUsarWindow() { return typeof window !== 'undefined' && typeof location !== 'undefined'; }

if (podeUsarWindow()) {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const dados = event.data;
    if (!dados || dados.canal !== CANAL) return;
    if (dados.tipo === 'extensao_presente') { presenca = dados; return; }
    // postMessage também entrega o request de saída aos listeners da própria página.
    if (dados.id && dados.tipo && dados.ok === undefined) return;
    depura.push({ etapa: 'recebida', id: dados.id, tipo: dados.tipo, ok: dados.ok, pendentes: [...pendentes.keys()] });
    if (depura.length > 30) depura.shift();
    const p = pendentes.get(dados.id);
    if (!p) return;
    pendentes.delete(dados.id);
    clearTimeout(p.timer);
    dados.ok ? p.resolve(dados.resposta) : p.reject(new Error(dados.erro || 'extensão não respondeu'));
  });
}

function enviar(tipo, dados = {}, timeoutMs = 1000) {
  if (!podeUsarWindow()) return Promise.reject(new Error('ponte disponível apenas no navegador'));
  return new Promise((resolve, reject) => {
    const id = 'myn-' + Date.now().toString(36) + '-' + (++seq).toString(36);
    const timer = setTimeout(() => { pendentes.delete(id); reject(new Error('extensão não detectada')); }, timeoutMs);
    pendentes.set(id, { resolve, reject, timer });
    depura.push({ etapa: 'enviada', id, tipo, pendentes: [...pendentes.keys()] });
    window.postMessage({ canal: CANAL, id, tipo, ...dados }, location.origin);
  });
}

export async function disponivel() {
  if (presenca) return true;
  for (let i = 0; i < 4; i++) {
    try {
      const resposta = await enviar('ping', {}, 800);
      if (resposta?.versao) presenca = { versao: resposta.versao };
      return true;
    } catch {
      if (i < 3) await new Promise((r) => setTimeout(r, 250));
    }
  }
  return false;
}

export function versao() { return presenca?.versao || null; }
export function diagnostico() { return [...depura]; }
export function abrirVM() { return enviar('abrir_vm', {}, 5000); }
export function listarRotas() { return enviar('listar_rotas', {}, 3000); }
export function executarRota(rotaId, texto, timeoutMs = 100000) { return enviar('executar_rota', { rotaId, texto }, timeoutMs); }
