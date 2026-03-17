(() => {
  const LIMITS = {
    density: { min: 120, max: 1800 },
    speed: { min: 0.25, max: 2.4 }
  };

  const DEFAULTS = {
    density: 420,
    speed: 1,
    theme: "green"
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const ui = {
    density: document.getElementById("density"),
    speed: document.getElementById("speed"),
    speedLabel: document.getElementById("speedLabel"),
    theme: document.getElementById("theme"),
    status: document.getElementById("status"),
    warning: document.getElementById("warning")
  };

  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("scene"), antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020617);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 250);
  camera.position.set(0, 0, 70);

  const glyphChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#$%*+-";
  const pool = [];
  let runningDensity = DEFAULTS.density;
  let degraded = false;
  let fpsSamples = [];

  function setStatus(msg, kind) {
    ui.status.textContent = msg;
    ui.status.className = `status ${kind}`;
  }

  function readConfig() {
    let density = Math.floor(Number(ui.density.value));
    let speed = Number(ui.speed.value);

    if (!Number.isFinite(density)) density = DEFAULTS.density;
    if (!Number.isFinite(speed)) speed = DEFAULTS.speed;

    density = clamp(density, LIMITS.density.min, LIMITS.density.max);
    speed = clamp(speed, LIMITS.speed.min, LIMITS.speed.max);

    ui.density.value = String(density);
    ui.speed.value = String(speed);
    ui.speedLabel.textContent = `${speed.toFixed(2)}x`;

    return { density, speed, theme: ui.theme.value };
  }

  function colorForTheme(theme) {
    if (theme === "cyan") return 0x22d3ee;
    if (theme === "amber") return 0xf59e0b;
    return 0x22c55e;
  }

  function makeGlyphTexture(char, colorHex) {
    const size = 64;
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const g = c.getContext("2d");
    g.fillStyle = "rgba(0,0,0,0)";
    g.fillRect(0, 0, size, size);
    g.font = "bold 42px Consolas";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = `#${colorHex.toString(16).padStart(6, "0")}`;
    g.fillText(char, size / 2, size / 2 + 2);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }

  function clearPool() {
    pool.forEach((item) => {
      scene.remove(item.sprite);
      item.sprite.material.map.dispose();
      item.sprite.material.dispose();
    });
    pool.length = 0;
  }

  function seeded(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function rebuild() {
    const cfg = readConfig();
    clearPool();

    runningDensity = cfg.density;
    degraded = false;
    ui.warning.hidden = true;
    fpsSamples = [];

    const rand = seeded(2204);
    const colorHex = colorForTheme(cfg.theme);

    for (let i = 0; i < runningDensity; i += 1) {
      const ch = glyphChars[Math.floor(rand() * glyphChars.length)];
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: makeGlyphTexture(ch, colorHex), transparent: true, opacity: 0.78 })
      );

      sprite.scale.set(1.5, 1.5, 1);
      sprite.position.set((rand() - 0.5) * 95, (rand() - 0.5) * 70, (rand() - 0.5) * 40);
      scene.add(sprite);

      pool.push({
        sprite,
        velocity: 0.1 + rand() * 0.6,
        drift: (rand() - 0.5) * 0.03,
        baseCharIndex: Math.floor(rand() * glyphChars.length)
      });
    }

    setStatus(`Reset complete (${runningDensity} glyphs, theme ${cfg.theme}).`, "success");
  }

  function maybeDegrade(fps) {
    fpsSamples.push(fps);
    if (fpsSamples.length > 100) fpsSamples.shift();

    if (degraded || fpsSamples.length < 50) return;
    const avg = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

    if (avg < 28 && runningDensity > 360) {
      const target = Math.max(360, Math.floor(runningDensity * 0.65));
      for (let i = runningDensity - 1; i >= target; i -= 1) {
        const item = pool.pop();
        scene.remove(item.sprite);
        item.sprite.material.map.dispose();
        item.sprite.material.dispose();
      }
      runningDensity = target;
      degraded = true;
      ui.warning.hidden = false;
      setStatus(`Degraded mode active at avg FPS ${avg.toFixed(1)}.`, "warn");
    }
  }

  let last = performance.now();

  function animate(now) {
    const dtSec = Math.max(0.001, (now - last) / 1000);
    last = now;

    const cfg = readConfig();

    pool.forEach((item, index) => {
      item.sprite.position.y -= item.velocity * cfg.speed;
      item.sprite.position.x += item.drift;

      if (item.sprite.position.y < -42) {
        item.sprite.position.y = 42;
        item.sprite.position.x = ((index * 13) % 90) - 45;
      }

      if (item.sprite.position.x < -48) item.sprite.position.x = 48;
      if (item.sprite.position.x > 48) item.sprite.position.x = -48;
    });

    maybeDegrade(1 / dtSec);

    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  document.getElementById("reset").addEventListener("click", rebuild);
  ui.speed.addEventListener("input", () => {
    ui.speedLabel.textContent = `${clamp(Number(ui.speed.value), LIMITS.speed.min, LIMITS.speed.max).toFixed(2)}x`;
  });

  window.addEventListener("resize", resize);
  resize();
  rebuild();
  requestAnimationFrame(animate);
})();
