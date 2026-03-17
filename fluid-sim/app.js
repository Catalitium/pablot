(() => {
  const qualityEl = document.getElementById("quality");
  const iterEl = document.getElementById("iterations");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const canvas = document.getElementById("sim");
  const ctx = canvas.getContext("2d");

  const RES_MAP = { low: 64, medium: 96, high: 128 };
  const MAX_RES = 128;
  const MAX_ITERS = 25;

  let grid = [];
  let size = RES_MAP.medium;
  let lastFrame = performance.now();
  let lowFpsCount = 0;

  function alloc(n) {
    const g = [];
    for (let y = 0; y < n; y++) {
      const row = new Array(n).fill(0);
      g.push(row);
    }
    return g;
  }

  function seed(g) {
    const n = g.length;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const dx = (x - n/2) / n;
        const dy = (y - n/2) / n;
        g[y][x] = Math.exp(-(dx*dx + dy*dy) * 40);
      }
    }
  }

  function clampSettings() {
    const target = RES_MAP[qualityEl.value] || RES_MAP.medium;
    size = Math.min(MAX_RES, target);
    let iters = Number(iterEl.value);
    if (!Number.isFinite(iters)) iters = 10;
    iters = Math.max(1, Math.min(MAX_ITERS, Math.round(iters)));
    iterEl.value = String(iters);
    return iters;
  }

  function step(iterations) {
    const n = grid.length;
    for (let it = 0; it < iterations; it++) {
      const next = alloc(n);
      for (let y = 1; y < n - 1; y++) {
        for (let x = 1; x < n - 1; x++) {
          next[y][x] = (grid[y][x] * 0.5 + grid[y-1][x] * 0.125 + grid[y+1][x] * 0.125 + grid[y][x-1] * 0.125 + grid[y][x+1] * 0.125);
        }
      }
      grid = next;
    }
  }

  function draw() {
    const n = grid.length;
    const cellW = canvas.width / n;
    const cellH = canvas.height / n;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = Math.max(0, Math.min(1, grid[y][x]));
        const hue = 220 - Math.floor(v * 180);
        ctx.fillStyle = `hsl(${hue}, 80%, ${20 + v*50}%)`;
        ctx.fillRect(x * cellW, y * cellH, Math.ceil(cellW), Math.ceil(cellH));
      }
    }
  }

  function reset() {
    clampSettings();
    grid = alloc(size);
    seed(grid);
    lowFpsCount = 0;
    statusEl.classList.remove("warn");
    statusEl.textContent = `Reset deterministic seed at ${size}x${size}.`;
  }

  function frame(now) {
    const dt = now - lastFrame;
    lastFrame = now;
    const fps = dt > 0 ? 1000 / dt : 60;
    let iterations = clampSettings();

    if (fps < 20) lowFpsCount += 1;
    else lowFpsCount = Math.max(0, lowFpsCount - 1);

    if (lowFpsCount > 30) {
      iterations = Math.max(1, Math.floor(iterations / 2));
      statusEl.classList.add("warn");
      statusEl.textContent = `Low FPS fallback active. Iterations reduced to ${iterations}.`;
    }

    step(iterations);
    draw();
    requestAnimationFrame(frame);
  }

  resetBtn.addEventListener("click", reset);
  qualityEl.addEventListener("change", reset);
  reset();
  requestAnimationFrame(frame);
})();
