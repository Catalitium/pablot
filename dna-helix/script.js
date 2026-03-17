(() => {
  const c = document.getElementById('helix');
  const ctx = c.getContext('2d');
  const speedEl = document.getElementById('speed');
  const spacingEl = document.getElementById('spacing');
  const labelsEl = document.getElementById('labels');
  const statusEl = document.getElementById('status');
  const bases = ['A','T','C','G'];
  let t = 0;

  function draw(){
    const speed = Number(speedEl.value) || 1;
    const spacing = Number(spacingEl.value) || 14;
    t += 0.03 * speed;
    ctx.clearRect(0,0,c.width,c.height);

    const cx = c.width / 2;
    const amp = 120;
    const seg = 34;
    for (let i=0; i<seg; i++) {
      const y = 30 + i * spacing;
      if (y > c.height - 20) break;
      const phase = t + i * 0.35;
      const x1 = cx + Math.sin(phase) * amp;
      const x2 = cx + Math.sin(phase + Math.PI) * amp;

      ctx.strokeStyle = '#5eead4';
      ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y); ctx.stroke();

      ctx.fillStyle = '#60a5fa'; ctx.beginPath(); ctx.arc(x1,y,6,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(x2,y,6,0,Math.PI*2); ctx.fill();

      if (labelsEl.checked) {
        ctx.fillStyle = '#e7f1ff'; ctx.font = '11px Segoe UI';
        ctx.fillText(bases[i % 4], x1 - 3, y - 10);
        ctx.fillText(bases[(i+2) % 4], x2 - 3, y - 10);
      }
    }

    statusEl.textContent = 'Animation running.';
    requestAnimationFrame(draw);
  }

  draw();
})();
