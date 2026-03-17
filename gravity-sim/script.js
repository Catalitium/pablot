(() => {
  const LIMITS = {
    count: { min: 2, max: 120 },
    massScale: { min: 0.5, max: 4.0 },
    dt: { min: 0.002, max: 0.03 },
    velocityCap: 3.5,
    worldRadius: 16
  };

  const SAFE_DEFAULTS = {
    count: 40,
    massScale: 1.6,
    dt: 0.012
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const ui = {
    count: document.getElementById("bodyCount"),
    massScale: document.getElementById("massScale"),
    massLabel: document.getElementById("massLabel"),
    dt: document.getElementById("dt"),
    dtLabel: document.getElementById("dtLabel"),
    status: document.getElementById("status"),
    warning: document.getElementById("warning"),
    toggle: document.getElementById("toggle")
  };

  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById("scene"), antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060e);

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  camera.position.set(0, 0, 36);

  const lightA = new THREE.DirectionalLight(0xffffff, 0.9);
  lightA.position.set(8, 12, 12);
  const lightB = new THREE.AmbientLight(0x90a4ff, 0.45);
  scene.add(lightA, lightB);

  const starGeom = new THREE.BufferGeometry();
  const stars = [];
  for (let i = 0; i < 700; i += 1) {
    stars.push((i * 29) % 120 - 60, (i * 43) % 80 - 40, -20 - (i % 40));
  }
  starGeom.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
  scene.add(new THREE.Points(starGeom, new THREE.PointsMaterial({ size: 0.12, color: 0x9ca3af })));

  let bodies = [];
  let meshes = [];
  let running = true;

  function setStatus(msg, kind) {
    ui.status.textContent = msg;
    ui.status.className = `status ${kind}`;
  }

  function readConfig() {
    let clamped = false;

    let count = Math.floor(Number(ui.count.value));
    let massScale = Number(ui.massScale.value);
    let dt = Number(ui.dt.value);

    if (!Number.isFinite(count)) count = SAFE_DEFAULTS.count;
    if (!Number.isFinite(massScale)) massScale = SAFE_DEFAULTS.massScale;
    if (!Number.isFinite(dt)) dt = SAFE_DEFAULTS.dt;

    const c2 = clamp(count, LIMITS.count.min, LIMITS.count.max);
    const m2 = clamp(massScale, LIMITS.massScale.min, LIMITS.massScale.max);
    const d2 = clamp(dt, LIMITS.dt.min, LIMITS.dt.max);

    if (c2 !== count || m2 !== massScale || d2 !== dt) clamped = true;

    ui.count.value = String(c2);
    ui.massScale.value = String(m2);
    ui.dt.value = String(d2);
    ui.massLabel.textContent = m2.toFixed(1);
    ui.dtLabel.textContent = d2.toFixed(3);
    ui.warning.hidden = !clamped;

    return { count: c2, massScale: m2, dt: d2 };
  }

  function seeded(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return x / 4294967296;
    };
  }

  function clearBodies() {
    meshes.forEach((m) => {
      scene.remove(m);
      m.geometry.dispose();
      m.material.dispose();
    });
    meshes = [];
    bodies = [];
  }

  function resetSim() {
    const cfg = readConfig();
    clearBodies();

    const rand = seeded(2203);

    for (let i = 0; i < cfg.count; i += 1) {
      const r = 2 + rand() * 12;
      const a = rand() * Math.PI * 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;

      const tangent = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0).multiplyScalar(0.4 + rand() * 0.8);

      const mass = (0.6 + rand() * 1.8) * cfg.massScale;
      const size = 0.08 + mass * 0.08;

      const geom = new THREE.SphereGeometry(size, 10, 10);
      const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.58 + rand() * 0.16, 0.75, 0.62) });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(px, py, 0);
      scene.add(mesh);

      meshes.push(mesh);
      bodies.push({ pos: new THREE.Vector3(px, py, 0), vel: tangent, mass });
    }

    setStatus(`Reset with ${cfg.count} bodies.`, "success");
  }

  function stepSimulation() {
    const cfg = readConfig();
    const dt = cfg.dt;
    const G = 6.5;

    for (let i = 0; i < bodies.length; i += 1) {
      const bi = bodies[i];
      const acc = new THREE.Vector3();

      for (let j = 0; j < bodies.length; j += 1) {
        if (i === j) continue;
        const bj = bodies[j];
        const d = bj.pos.clone().sub(bi.pos);
        const distSq = clamp(d.lengthSq(), 0.2, 900);
        const force = (G * bj.mass) / distSq;
        acc.add(d.normalize().multiplyScalar(force));
      }

      bi.vel.add(acc.multiplyScalar(dt));
      const speed = bi.vel.length();
      if (speed > LIMITS.velocityCap) {
        bi.vel.multiplyScalar(LIMITS.velocityCap / speed);
      }
    }

    for (let i = 0; i < bodies.length; i += 1) {
      const b = bodies[i];
      b.pos.add(b.vel.clone().multiplyScalar(dt));

      if (b.pos.length() > LIMITS.worldRadius) {
        b.pos.multiplyScalar(0.96);
        b.vel.multiplyScalar(-0.6);
      }

      meshes[i].position.copy(b.pos);
    }
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function animate() {
    if (running) stepSimulation();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  ui.massScale.addEventListener("input", () => {
    ui.massLabel.textContent = clamp(Number(ui.massScale.value), LIMITS.massScale.min, LIMITS.massScale.max).toFixed(1);
  });
  ui.dt.addEventListener("input", () => {
    ui.dtLabel.textContent = clamp(Number(ui.dt.value), LIMITS.dt.min, LIMITS.dt.max).toFixed(3);
  });

  ui.toggle.addEventListener("click", () => {
    running = !running;
    ui.toggle.textContent = running ? "Pause" : "Start";
    setStatus(running ? "Simulation running." : "Simulation paused.", "neutral");
  });

  document.getElementById("reset").addEventListener("click", () => {
    resetSim();
    running = true;
    ui.toggle.textContent = "Pause";
  });

  window.addEventListener("resize", resize);
  resize();
  resetSim();
  animate();
})();
