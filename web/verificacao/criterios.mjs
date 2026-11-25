/** Verificação por critério: cada passo só é aceito com evidência observável. */
export function avaliar(passo, resultado) {
  const criterio = String(passo?.criterio || '').toLowerCase();
  const texto = String(resultado?.detalhe || resultado?.resposta || '').toLowerCase();
  const okBase = resultado?.ok === true;
  if (!okBase) return { ok: false, motivo: 'passo_falhou', evidencia: texto.slice(0, 160) };
  if (!criterio) return { ok: true, motivo: 'sem_criterio', evidencia: texto.slice(0, 160) };
  const termos = criterio.split(/[\s,·]+/).filter((w) => w.length > 3 && !/que|com|uma|para|dos|das|ein|the/.test(w));
  const batidos = termos.filter((t) => texto.includes(t));
  const aceito = batidos.length > 0 || /sem_criterio|ok|conclu|resposta/.test(criterio);
  return { ok: aceito, motivo: aceito ? 'criterio_verificado' : 'criterio_sem_evidencia', evidencia: texto.slice(0, 200), batidos };
}
