(() => {
  const DEFAULTS = {
    seed: 42,
    count: 1200,
    radius: 220,
    spin: 4,
    randomness: 0.25
  };

  const LIMITS = {
    count: { min: 100, max: 5000 },
    radius: { min: 20, max: 500 },
    spin: { min: 0, max: 12 },
    randomness: { min: 0, max: 1 }
  };

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("status");
  const degradedBadge = document.getElementById("degraded");

  const inputs = {
    seed: document.getElementById("seed"),
    count: document.getElementById("count"),
    radius: document.getElementById("radius"),
    spin: document.getElementById("spin"),
    randomness: document.getElementById("randomness")
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function setStatus(message, kind) {
    status.textContent = message;
    status.className = `status ${kind}`;
  }

  function makeRng(seedValue) {
    let seed = Math.floor(seedValue) >>> 0;
    if (seed === 0) seed = 1;
    return () => {
      seed = (1664525 * seed + 1013904223) >>> 0;
      return seed / 4294967296;
    };
  }

  let width = 0;
  let height = 0;
  let particles = [];
  let angle = 0;
  let degraded = false;
  let fpsHistory = [];

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function readConfig() {
    const cfg = {
      seed: Number(inputs.seed.value),
      count: clamp(Number(inputs.count.value), LIMITS.count.min, LIMITS.count.max),
      radius: clamp(Number(inputs.radius.value), LIMITS.radius.min, LIMITS.radius.max),
      spin: clamp(Number(inputs.spin.value), LIMITS.spin.min, LIMITS.spin.max),
      randomness: clamp(Number(inputs.randomness.value), LIMITS.randomness.min, LIMITS.randomness.max)
    };

    if (!Number.isFinite(cfg.seed)) cfg.seed = DEFAULTS.seed;
    if (!Number.isFinite(cfg.count)) cfg.count = DEFAULTS.count;
    if (!Number.isFinite(cfg.radius)) cfg.radius = DEFAULTS.radius;
    if (!Number.isFinite(cfg.spin)) cfg.spin = DEFAULTS.spin;
    if (!Number.isFinite(cfg.randomness)) cfg.randomness = DEFAULTS.randomness;

    inputs.seed.value = String(Math.floor(cfg.seed));
    inputs.count.value = String(Math.floor(cfg.count));
    inputs.radius.value = String(cfg.radius);
    inputs.spin.value = String(cfg.spin);
    inputs.randomness.value = String(cfg.randomness);

    return cfg;
  }

  function buildGalaxy() {
    const cfg = readConfig();
    const rng = makeRng(cfg.seed);
    particles = [];

    for (let i = 0; i < cfg.count; i += 1) {
      const t = i / cfg.count;
      const branch = i % 4;
      const baseAngle = branch * (Math.PI * 0.5);
      const r = Math.pow(t, 0.85) * cfg.radius;
      const swirl = baseAngle + cfg.spin * t;
      const spread = cfg.randomness * cfg.radius;
      const jitterX = (rng() - 0.5) * spread;
      const jitterY = (rng() - 0.5) * spread;
      const depth = (rng() - 0.5) * 150;
      const hue = 200 + 100 * t + (rng() - 0.5) * 20;

      particles.push({
        x: Math.cos(swirl) * r + jitterX,
        y: Math.sin(swirl) * r + jitterY,
        z: depth,
        size: 0.9 + rng() * 1.6,
        hue
      });
    }

    degraded = false;
    degradedBadge.hidden = true;
    setStatus(`Generated ${particles.length} particles (seed ${Math.floor(cfg.seed)}).`, "success");
  }

  function maybeDegrade(fps) {
    fpsHistory.push(fps);
    if (fpsHistory.length > 120) fpsHistory.shift();

    if (degraded) return;
    const avg = fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length;

    if (fpsHistory.length >= 60 && avg < 30 && particles.length > 800) {
      particles = particles.slice(0, Math.max(800, Math.floor(particles.length * 0.6)));
      degraded = true;
      degradedBadge.hidden = false;
      setStatus(`Performance fallback engaged at avg FPS ${avg.toFixed(1)}.`, "warn");
    }
  }

  function drawFrame(deltaSeconds) {
    angle += deltaSeconds * 0.22;

    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;

    for (const p of particles) {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const rx = p.x * cosA - p.y * sinA;
      const ry = p.x * sinA + p.y * cosA;

      const perspective = 1 / (1 + (p.z + 220) / 500);
      const sx = cx + rx * perspective;
      const sy = cy + ry * perspective;

      if (sx < -2 || sx > width + 2 || sy < -2 || sy > height + 2) continue;

      ctx.fillStyle = `hsl(${p.hue}, 75%, 70%)`;
      ctx.beginPath();
      ctx.arc(sx, sy, p.size * perspective, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  let lastTime = performance.now();

  function animate(now) {
    const dt = Math.max(0.001, (now - lastTime) / 1000);
    lastTime = now;
    const fps = 1 / dt;

    maybeDegrade(fps);
    drawFrame(dt);

    requestAnimationFrame(animate);
  }

  document.getElementById("regen").addEventListener("click", buildGalaxy);
  window.addEventListener("resize", resize);

  resize();
  buildGalaxy();
  requestAnimationFrame(animate);
})();
