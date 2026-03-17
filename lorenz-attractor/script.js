(() => {
  const c = document.getElementById('plot');
  const ctx = c.getContext('2d');
  const statusEl = document.getElementById('status');
  const inputs = {
    sigma: document.getElementById('sigma'),
    rho: document.getElementById('rho'),
    beta: document.getElementById('beta'),
    dt: document.getElementById('dt')
  };
  let p = { x: 0.1, y: 0, z: 0 };
  let trail = [];

  function stepEuler(pt, s, r, b, dt){
    return {
      x: pt.x + (s * (pt.y - pt.x)) * dt,
      y: pt.y + (pt.x * (r - pt.z) - pt.y) * dt,
      z: pt.z + (pt.x * pt.y - b * pt.z) * dt
    };
  }

  function reset(){ p = { x: 0.1, y: 0, z: 0 }; trail = []; statusEl.textContent = 'Integrator: Euler'; }

  function frame(){
    const sigma = Number(inputs.sigma.value) || 10;
    const rho = Number(inputs.rho.value) || 28;
    const beta = Number(inputs.beta.value) || 2.67;
    const dtRaw = Number(inputs.dt.value) || 0.01;
    const dt = Math.max(0.001, Math.min(0.03, dtRaw));
    if (dt !== dtRaw) statusEl.textContent = 'dt clamped for stability.';

    for (let i=0; i<6; i++) {
      p = stepEuler(p, sigma, rho, beta, dt);
      trail.push({ x: p.x, z: p.z });
      if (trail.length > 3000) trail.shift();
    }

    ctx.fillStyle = 'rgba(13,23,46,0.1)';
    ctx.fillRect(0,0,c.width,c.height);
    ctx.beginPath();
    trail.forEach((t, i) => {
      const px = c.width/2 + t.x * 7;
      const py = c.height/2 + t.z * 5;
      if (i===0) ctx.moveTo(px,py); else ctx.lineTo(px,py);
    });
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    requestAnimationFrame(frame);
  }

  document.getElementById('reset').addEventListener('click', reset);
  reset();
  frame();
})();
