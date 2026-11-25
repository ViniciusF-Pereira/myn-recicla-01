export async function relatorioRapido() {
  const b=process.env.MYN_API_BASE||'http://127.0.0.1:5188';
  const [p,s]=await Promise.all([fetch(b+'/api/plugins').then(r=>r.json()),fetch(b+'/api/saude').then(r=>r.json())]);
  return { plugins:p.total, saude:s.rotas.length };
}
console.log(JSON.stringify(await relatorioRapido()));

