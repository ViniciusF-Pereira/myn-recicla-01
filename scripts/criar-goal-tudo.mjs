/** Cria o goal mestre que dirige a entrega completa do Myn Recyla, web-only + WebGPU. */
const base = process.env.MYN_API_BASE || 'http://127.0.0.1:5188';
const objetivo = process.env.MYN_GOAL_OBJETIVO || [
  'ENTREGAR TUDO: transformar o Myn Recyla num agente open-source tipo OpenCode/Claude Code/Codex,',
  'SOMENTE rotas free de navegador online + WebGPU, nada de PC local.',
  'F0 fundação web (cortar Node do browser, tools virtuais, rapido sem local);',
  'F1 orquestração (scoreboard no cliente, adaptadores online, gateway/relay hospedado);',
  'F2 RAG vetorial WebGPU com cascata WASM/TF-IDF;',
  'F3 agente de código (planejador determinístico, tool-use dentro do SSE, goal no browser, verificação por critério);',
  'F4 mídia e OCR 100% online (Pollinations/canvas, speechSynthesis, MediaRecorder webm, Gemini Lens);',
  'F5 open-source (MCP stdio, CI com bateria node:test, README/license/CONTRIBUTING).',
  'Seguir docs/PLANEJAMENTO.md e provar com scripts/avaliar.mjs',
].join(' ');
const r = await fetch(base + '/api/goal', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ objetivo, intervaloMs: 300000, maxExecucoes: 20, maxPassos: 6, executarAgora: true }),
  signal: AbortSignal.timeout(300000),
});
const d = await r.json();
console.log(JSON.stringify({ id: d.id, objetivo: d.objetivo?.slice(0, 120), ciclo: d.ultima && { sucessos: d.ultima.sucessos, total: d.ultima.total, ms: d.ultima.ms, via: d.ultima.via } }, null, 2));
