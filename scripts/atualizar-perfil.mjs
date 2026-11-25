/** Busca dados públicos do GitHub e grava site/perfil.json para a seção Created By. */
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
const usuario = process.env.GITHUB_USER || 'ViniciusF-Pereira';

async function gh(path, jq) {
  const r = await run('gh', ['api', path, '--jq', jq], { timeout: 60000 });
  return JSON.parse(r.stdout || '[]');
}
const user = await gh('users/' + usuario, '{login,name,avatar_url,html_url,bio,blog,location,company,public_repos,followers,following,created_at,updated_at}');
const repos = await gh('users/' + usuario + '/repos', 'sort_by(-.stargazers_count) | .[0:6] | map({name,html_url,description,stargazers_count,language,fork,updated_at})');
const linkedin = /linkedin\.com\/in\/[^\s]+/i.exec(user.blog || '')?.[0] || '';
const perfil = {
  ...user,
  linkedin,
  repos,
  projeto: 'Myn Recyla/01',
  assinatura: 'Vinicius de Freitas — Myn Recyla/01',
  atualizadoEm: new Date().toISOString(),
  fonte: 'https://api.github.com/users/' + usuario,
};
await writeFile('site/perfil.json', JSON.stringify(perfil, null, 2) + '\n');
console.log(JSON.stringify({ nome: perfil.name, linkedin: perfil.linkedin, repos: repos.length, seguidores: perfil.followers }));
