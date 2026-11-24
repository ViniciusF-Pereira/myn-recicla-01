/** Agente mínimo: um chat Browser decide, o harness executa tools com escopo. */
import { repararComando } from './reparo.mjs';

export async function rodarTarefa({ gateway, rota, tarefas, maxPassos = 12, log = () => {} }) {
  const permitidos = tarefas.map((t) => t.arquivo);
  const instrucao = 'Você decide; um sistema externo executa. Escreva SOMENTE uma linha: TOOL write_file path=' + tarefas[0].arquivo + ' content=' + tarefas[0].conteudo + ' (ou TOOL read_file path=... para conferir, ou DONE). Sem explicação.';
  let mensagem = instrucao;
  const historico = [];
  await gateway.op('navigate', { url: rota.url });
  await new Promise((r) => setTimeout(r, 1500));
  await gateway.ativar(new URL(rota.url).hostname).catch(() => undefined);
  await new Promise((r) => setTimeout(r, 2500));

  for (let passo = 1; passo <= maxPassos; passo++) {
    await gateway.enviar(mensagem, rota.send);
    const resposta = (await gateway.resposta(mensagem)).trim();
    log({ passo, resposta: resposta.slice(0, 240) });
    if (/^DONE[.!]?$/i.test(resposta.trim())) { historico.push({ passo, acao: 'DONE' }); break; }
    const comando = repararComando(resposta, ['write_file', 'read_file', 'list_files', 'run_tests']);
    if (!comando || !permitidos.includes(comando.args.path)) {
      historico.push({ passo, aceito: false, motivo: 'fora_do_escopo' });
      mensagem = 'RESULTADO: recusado. Use TOOL write_file path=' + tarefas[0].arquivo + ' content=' + tarefas[0].conteudo + '.';
      continue;
    }
    historico.push({ passo, aceito: true, ...comando });
    const alvo = tarefas.find((t) => t.arquivo === comando.args.path);
    mensagem = comando.tool === 'write_file'
      ? 'RESULTADO: ok. Confira com TOOL read_file path=' + alvo.arquivo + '.'
      : 'RESULTADO: conferido. Próximo: TOOL write_file path=' + (tarefas.find((t) => t.arquivo !== alvo.arquivo)?.arquivo ?? 'x') + ' content=...';
  }
  return historico;
}

/** Orquestrador: tarefas independentes em paralelo, com trava para a aba compartilhada. */
export async function orquestrar({ gateway, config, tarefas, trava, ferramentas, log = () => {} }) {
  const resultados = await Promise.all(tarefas.map(async (tarefa) => {
    const rota = config.rotas[tarefa.rota];
    if (!rota) return { ...tarefa, ok: false, erro: 'rota_ausente' };
    const prompt = 'Você é um worker. Você NÃO executa arquivos; um sistema externo executa. Responda SOMENTE uma linha, sem explicação: TOOL write_file path=' + tarefa.arquivo + ' content=' + tarefa.conteudo;
    try {
      return await trava(async () => {
        await gateway.op('navigate', { url: rota.url });
        await new Promise((r) => setTimeout(r, 1500));
        await gateway.ativar(new URL(rota.url).hostname).catch(() => undefined);
        await new Promise((r) => setTimeout(r, 2000));
        await gateway.enviar(prompt, rota.send);
        const resposta = (await gateway.resposta(prompt, 16)).trim();
        const comando = repararComando(resposta, ['write_file']);
        if (!comando || comando.args.path !== tarefa.arquivo) return { ...tarefa, ok: false, erro: 'fora_do_escopo', resposta: resposta.slice(-160) };
        const r = await ferramentas.executar('write_file', { path: tarefa.arquivo, content: tarefa.conteudo });
        log({ worker: tarefa.rota, ok: r.ok });
        return { ...tarefa, ok: r.ok, worker: tarefa.rota };
      });
    } catch (erro) { return { ...tarefa, ok: false, erro: String(erro.message).slice(0, 120) }; }
  }));
  return resultados;
}
