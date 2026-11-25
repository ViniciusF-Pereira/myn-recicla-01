/** Sessão "Created By": identidade do autor, editável e persistida no DB leve. */
import { obter, inserir } from '../web/db/leve.mjs';

export const PADRAO = {
  id: 'autor',
  nome: 'Vinicius de Freitas Pereira',
  github: 'https://github.com/ViniciusF-Pereira',
  linkedin: '',
  projeto: 'Myn Recicla/01',
  assinatura: 'Vinicius de Freitas — Myn Recicla/01',
};

export async function carregar() {
  const salvo = await obter('sessoes', 'autor');
  return { ...PADRAO, ...(salvo || {}) };
}
export async function salvar(dados) {
  return inserir('sessoes', { ...PADRAO, ...dados, id: 'autor', tipo: 'created-by', t: Date.now() });
}
export function markdown(s) {
  const li = s.linkedin ? ` · [LinkedIn](${s.linkedin})` : '';
  return `**Created By** — [${s.nome}](${s.github})${li} · [GitHub](${s.github}) · ${s.projeto}`;
}
