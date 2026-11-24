/** Agregador de conta Google: sonda rotas no navegador logado, sem ler cookies/credenciais. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { executarPlugin, encontrarPlugin } from './plugins.mjs';

const RAIZ = process.cwd();
const LOGIN = /sign in|fazer login|entrar na conta|log in|choose an account|escolha uma conta|inscrever-se/i;
const EMAIL = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;

export async function carregarRotasGoogle() {
  const plugins = JSON.parse(await readFile(path.join(RAIZ, 'config/plugins.json'), 'utf8')).plugins;
  return plugins.filter((p) => p.conta === 'google');
}

/** Sonda cada rota e devolve estado observado. Nunca persiste conta, token ou cookie. */
export async function sondarGoogle({ gateway, trava, rotas }) {
  const resultados = [];
  let conta = null;
  for (const rota of rotas) {
    const inicio = Date.now();
    const r = { id: rota.id, nome: rota.nome, url: rota.url, categoria: rota.categoria, limite: rota.limite };
    try {
      await trava(async () => {
        await gateway.op('navigate', { url: rota.url });
        await new Promise((x) => setTimeout(x, 1800));
        const texto = await gateway.ler(7000);
        r.loginDetectado = LOGIN.test(texto);
        const mail = EMAIL.exec(texto);
        if (mail && !conta) conta = mail[0];
        r.composer = await gateway.op('focus-composer', {}, AbortSignal.timeout(8000))
          .then((v) => v.ok !== false).catch(() => false);
        r.estado = r.loginDetectado ? 'login' : r.composer ? 'ativo' : 'aberto';
        r.trecho = texto.replace(/\s+/g, ' ').trim().slice(0, 140);
      });
    } catch (erro) {
      r.estado = 'erro';
      r.erro = String(erro.message).slice(0, 120);
    }
    r.ms = Date.now() - inicio;
    resultados.push(r);
  }
  return { conta, rotas: resultados, em: new Date().toISOString() };
}

/** Executa uma rota Google já mapeada como plugin. */
export async function rodarRotaGoogle({ id, entrada, gateway, trava, plugins }) {
  const plugin = encontrarPlugin(plugins, id);
  if (!plugin) throw new Error('rota Google desconhecida: ' + id);
  if (plugin.confirmacao && !/^confirmar\s*:/i.test(String(entrada))) {
    return { confirmacao: true, aviso: 'Rota ' + plugin.nome + ' envia mensagem real. Repita: /' + id + ' confirmar: texto' };
  }
  const texto = plugin.confirmacao ? String(entrada).replace(/^confirmar\s*:/i, '').trim() : entrada;
  const d = await executarPlugin({ plugin, entrada: texto, gateway, trava });
  return { ...d, aviso: plugin.limite };
}
