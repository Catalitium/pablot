(() => {
  const LIMITS = {
    octaves: { min: 1, max: 7 },
    scale: { min: 0.01, max: 0.2 },
    amplitude: { min: 6, max: 80 },
    grid: { min: 32, max: 192 }
  };

  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");
  const status = document.getElementById("status");

  const inputs = {
    seed: document.getElementById("seed"),
    octaves: document.getElementById("octaves"),
    scale: document.getElementById("scale"),
    amplitude: document.getElementById("amplitude"),
    grid: document.getElementById("grid")
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
  }

  function hashSeed(seedText) {
    let h = 2166136261;
    const s = String(seedText || "0");
    for (let i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function rngFrom(seed) {
    let x = seed || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return ((x >>> 0) / 4294967296);
    };
  }

  function valueNoiseFactory(seed) {
    const cache = new Map();
    const rand = rngFrom(seed);

    function lattice(ix, iy) {
      const key = `${ix},${iy}`;
      if (cache.has(key)) return cache.get(key);
      const v = rand() * 2 - 1;
      cache.set(key, v);
      return v;
    }

    function smoothstep(t) {
      return t * t * (3 - 2 * t);
    }

    return function noise(x, y) {
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const x1 = x0 + 1;
      const y1 = y0 + 1;

      const tx = smoothstep(x - x0);
      const ty = smoothstep(y - y0);

      const v00 = lattice(x0, y0);
      const v10 = lattice(x1, y0);
      const v01 = lattice(x0, y1);
      const v11 = lattice(x1, y1);

      const i1 = v00 * (1 - tx) + v10 * tx;
      const i2 = v01 * (1 - tx) + v11 * tx;
      return i1 * (1 - ty) + i2 * ty;
    };
  }

  function readConfig() {
    let seedText = inputs.seed.value.trim();
    if (!seedText || seedText.toLowerCase() === "nan") seedText = "0";

    const cfg = {
      seedText,
      octaves: clamp(Math.floor(Number(inputs.octaves.value)), LIMITS.octaves.min, LIMITS.octaves.max),
      scale: clamp(Number(inputs.scale.value), LIMITS.scale.min, LIMITS.scale.max),
      amplitude: clamp(Number(inputs.amplitude.value), LIMITS.amplitude.min, LIMITS.amplitude.max),
      grid: clamp(Math.floor(Number(inputs.grid.value)), LIMITS.grid.min, LIMITS.grid.max)
    };

    if (!Number.isFinite(cfg.octaves)) cfg.octaves = 4;
    if (!Number.isFinite(cfg.scale)) cfg.scale = 0.045;
    if (!Number.isFinite(cfg.amplitude)) cfg.amplitude = 36;
    if (!Number.isFinite(cfg.grid)) cfg.grid = 96;

    inputs.seed.value = cfg.seedText;
    inputs.octaves.value = String(cfg.octaves);
    inputs.scale.value = String(cfg.scale);
    inputs.amplitude.value = String(cfg.amplitude);
    inputs.grid.value = String(cfg.grid);

    return cfg;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(320, Math.floor(rect.width));
    canvas.height = Math.max(240, Math.floor(rect.height));
  }

  function colorFor(h) {
    if (h < -8) return "#0ea5e9";
    if (h < -2) return "#38bdf8";
    if (h < 5) return "#eab308";
    if (h < 18) return "#22c55e";
    if (h < 30) return "#4d7c0f";
    if (h < 44) return "#64748b";
    return "#f8fafc";
  }

  function generate() {
    try {
      const cfg = readConfig();
      resizeCanvas();

      const seed = hashSeed(cfg.seedText);
      const noise = valueNoiseFactory(seed);

      const w = canvas.width;
      const h = canvas.height;
      const cellW = w / cfg.grid;
      const cellH = h / cfg.grid;

      ctx.clearRect(0, 0, w, h);

      for (let gy = 0; gy < cfg.grid; gy += 1) {
        for (let gx = 0; gx < cfg.grid; gx += 1) {
          let n = 0;
          let freq = cfg.scale;
          let amp = 1;
          let sumAmp = 0;

          for (let o = 0; o < cfg.octaves; o += 1) {
            n += noise(gx * freq, gy * freq) * amp;
            sumAmp += amp;
            amp *= 0.5;
            freq *= 2;
          }

          const normalized = n / sumAmp;
          const heightValue = normalized * cfg.amplitude;

          ctx.fillStyle = colorFor(heightValue);
          ctx.fillRect(gx * cellW, gy * cellH, Math.ceil(cellW) + 1, Math.ceil(cellH) + 1);
        }
      }

      setStatus(`Generated seed '${cfg.seedText}' with grid ${cfg.grid} and octaves ${cfg.octaves}.`, "success");
    } catch (err) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setStatus(`Render recovery path engaged: ${String(err.message || err)}`, "error");
    }
  }

  document.getElementById("regen").addEventListener("click", generate);
  window.addEventListener("resize", generate);

  generate();
})();
