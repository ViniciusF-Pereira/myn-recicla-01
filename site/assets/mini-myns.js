/** Mini Myns: olhinhos cupidinhos com asas e corpinho, voando em canvas. Sem dependência. */
(function () {
  const COR = {
    tinta: '#1b2430', azul: '#1f6fe0', azulCl: '#bcd8ff', creme: '#fffaf0',
    mostarda: '#d79a2f', mostardaCl: '#f4dfa8', branco: '#ffffff'
  };
  function criar(w, h, semente) {
    const r = () => Math.random();
    return {
      x: r() * w, y: r() * h,
      tam: 14 + r() * 20,
      vel: 0.12 + r() * 0.28,
      fase: r() * Math.PI * 2,
      voltas: 0.6 + r() * 1.4,
      asa: r() * Math.PI * 2,
      opacidade: 0.30 + r() * 0.45,
      tom: r() > 0.72 ? COR.mostarda : COR.azul,
      semente
    };
  }
  function asa(ctx, x, y, escala, flap, cor) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(Math.cos(flap) * 0.55 + 0.45, 1);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-escala * 0.9, -escala * 0.75, -escala * 1.5, -escala * 0.15, -escala * 1.25, escala * 0.42);
    ctx.bezierCurveTo(-escala * 0.8, escala * 0.2, -escala * 0.4, escala * 0.32, 0, escala * 0.18);
    ctx.closePath();
    ctx.fillStyle = cor; ctx.fill();
    ctx.strokeStyle = COR.tinta; ctx.lineWidth = Math.max(0.7, escala * 0.06); ctx.stroke();
    ctx.restore();
  }
  function desenhar(ctx, m, t) {
    const s = m.tam, osc = Math.sin(t * m.voltas * 0.001 + m.fase);
    const x = m.x + osc * s * 1.2, y = m.y + Math.cos(t * 0.0008 + m.fase) * s * 0.5;
    ctx.save();
    ctx.globalAlpha = m.opacidade;
    ctx.translate(x, y);
    ctx.rotate(osc * 0.12);
    // halo
    ctx.beginPath(); ctx.ellipse(0, -s * 1.05, s * 0.55, s * 0.16, 0, 0, Math.PI * 2);
    ctx.strokeStyle = COR.mostarda; ctx.lineWidth = Math.max(1, s * 0.09); ctx.stroke();
    // asas
    asa(ctx, -s * 0.35, -s * 0.05, s * 0.85, m.asa + t * 0.012, COR.branco);
    asa(ctx, s * 0.35, -s * 0.05, s * 0.85, -m.asa - t * 0.012, COR.branco);
    ctx.save(); ctx.scale(-1, 1);
    asa(ctx, -s * 0.35, -s * 0.05, s * 0.85, -m.asa - t * 0.012, COR.branco);
    ctx.restore();
    // corpinho
    ctx.beginPath(); ctx.ellipse(0, s * 0.55, s * 0.42, s * 0.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = COR.creme; ctx.fill();
    ctx.strokeStyle = COR.tinta; ctx.lineWidth = Math.max(0.8, s * 0.07); ctx.stroke();
    // bracinhos e pezinhos
    ctx.beginPath();
    ctx.moveTo(-s * 0.38, s * 0.5); ctx.lineTo(-s * 0.68, s * 0.28);
    ctx.moveTo(s * 0.38, s * 0.5); ctx.lineTo(s * 0.68, s * 0.28);
    ctx.moveTo(-s * 0.16, s * 1.0); ctx.lineTo(-s * 0.22, s * 1.28);
    ctx.moveTo(s * 0.16, s * 1.0); ctx.lineTo(s * 0.22, s * 1.28);
    ctx.strokeStyle = COR.tinta; ctx.lineWidth = Math.max(0.8, s * 0.07); ctx.stroke();
    // olho grande
    ctx.beginPath(); ctx.ellipse(0, -s * 0.05, s * 0.62, s * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = COR.branco; ctx.fill();
    ctx.strokeStyle = COR.tinta; ctx.lineWidth = Math.max(1, s * 0.09); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.26, 0, Math.PI * 2);
    ctx.fillStyle = m.tom; ctx.fill();
    ctx.strokeStyle = COR.tinta; ctx.lineWidth = Math.max(0.8, s * 0.06); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -s * 0.05, s * 0.11, 0, Math.PI * 2);
    ctx.fillStyle = COR.tinta; ctx.fill();
    ctx.beginPath(); ctx.arc(-s * 0.09, -s * 0.14, s * 0.055, 0, Math.PI * 2);
    ctx.fillStyle = COR.branco; ctx.fill();
    ctx.restore();
  }
  function iniciar(canvas, quantidade) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, lista = [], ultimo = performance.now();
    function resize() {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      lista = Array.from({ length: quantidade }, (_, i) => criar(w, h, i));
    }
    function frame(t) {
      const dt = Math.min(50, t - ultimo); ultimo = t;
      ctx.clearRect(0, 0, w, h);
      for (const m of lista) {
        m.y -= m.vel * dt * 0.02;
        m.asa += dt * 0.004;
        if (m.y < -m.tam * 2) { m.y = h + m.tam * 2; m.x = Math.random() * w; }
        desenhar(ctx, m, t);
      }
      requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(frame);
  }
  window.MynMyns = { iniciar };
  document.addEventListener('DOMContentLoaded', function () {
    iniciar(document.getElementById('mynsCeu'), 16);
    iniciar(document.getElementById('mynsFundo'), 9);
  });
})();
