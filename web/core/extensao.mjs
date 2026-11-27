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

function enviar(tipo, dados = {}, timeoutMs = 1000, signal) {
  if (!podeUsarWindow()) return Promise.reject(new Error('ponte disponível apenas no navegador'));
  if (signal?.aborted) return Promise.reject(new Error('operação cancelada'));
  return new Promise((resolve, reject) => {
    const id = 'myn-' + Date.now().toString(36) + '-' + (++seq).toString(36);
    let concluida = false;
    const limpar = () => { clearTimeout(timer); pendentes.delete(id); signal?.removeEventListener('abort', abort); };
    const abort = () => {
      if (concluida) return;
      concluida = true; limpar();
      window.postMessage({ canal: CANAL, id: 'cancelar-' + id, tipo: 'cancelar_operacao', operacaoId: id }, location.origin);
      reject(new Error('operação cancelada'));
    };
    const timer = setTimeout(() => { if (concluida) return; concluida = true; limpar(); reject(new Error('extensão não detectada')); }, timeoutMs);
    pendentes.set(id, {
      timer,
      resolve: (valor) => { if (concluida) return; concluida = true; limpar(); resolve(valor); },
      reject: (erro) => { if (concluida) return; concluida = true; limpar(); reject(erro); },
    });
    signal?.addEventListener('abort', abort, { once: true });
    depura.push({ etapa: 'enviada', id, tipo, pendentes: [...pendentes.keys()] });
    window.postMessage({ canal: CANAL, id, tipo, ...dados, operacaoId: id }, location.origin);
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
export function diagnosticarRota(rotaId, timeoutMs = 35000) { return enviar('diagnosticar_rota', { rotaId }, timeoutMs); }
export function executarRota(rotaId, texto, timeoutMs = 100000) { return enviar('executar_rota', { rotaId, texto }, timeoutMs); }
export function capturarManual(rotaId, timeoutMs = 35000) { return enviar('capturar_manual', { rotaId }, timeoutMs); }
export function descobrirRota(url, timeoutMs = 45000, signal) { return enviar('descobrir_rota', { url }, timeoutMs, signal); }
export function descobrirAbaAtual(timeoutMs = 45000, signal) { return enviar('descobrir_aba_atual', {}, timeoutMs, signal); }
export function ativarDescoberta(id, seletores = {}, timeoutMs = 10000, signal) { return enviar('ativar_descoberta', { descobertaId: id, seletores }, timeoutMs, signal); }
