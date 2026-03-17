(() => {
  const LIMITS = {
    depth: { min: 1, max: 10 },
    angle: { min: 5, max: 60 },
    scale: { min: 0.45, max: 0.82 }
  };

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const canvas = document.getElementById("scene");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050914);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  camera.position.set(0, 8, 22);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x1f2937, 1.0);
  const dir = new THREE.DirectionalLight(0xffffff, 0.95);
  dir.position.set(7, 12, 9);
  scene.add(hemi, dir);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(16, 48),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.95, metalness: 0.02 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -6;
  scene.add(ground);

  const ui = {
    depth: document.getElementById("depth"),
    angle: document.getElementById("angle"),
    angleLabel: document.getElementById("angleLabel"),
    scale: document.getElementById("scale"),
    scaleLabel: document.getElementById("scaleLabel"),
    status: document.getElementById("status"),
    warning: document.getElementById("warning")
  };

  let treeGroup = new THREE.Group();
  scene.add(treeGroup);
  let building = false;

  function setStatus(message, kind) {
    ui.status.textContent = message;
    ui.status.className = `status ${kind}`;
  }

  function readControls() {
    let clamped = false;

    let depth = Math.floor(Number(ui.depth.value));
    let angle = Number(ui.angle.value);
    let scale = Number(ui.scale.value);

    if (!Number.isFinite(depth)) depth = 7;
    if (!Number.isFinite(angle)) angle = 24;
    if (!Number.isFinite(scale)) scale = 0.69;

    const d2 = clamp(depth, LIMITS.depth.min, LIMITS.depth.max);
    const a2 = clamp(angle, LIMITS.angle.min, LIMITS.angle.max);
    const s2 = clamp(scale, LIMITS.scale.min, LIMITS.scale.max);

    if (d2 !== depth || a2 !== angle || s2 !== scale) clamped = true;

    ui.depth.value = String(d2);
    ui.angle.value = String(a2);
    ui.scale.value = String(s2);
    ui.angleLabel.textContent = `${a2.toFixed(0)}°`;
    ui.scaleLabel.textContent = s2.toFixed(2);
    ui.warning.hidden = !clamped;

    return { depth: d2, angleDeg: a2, scale: s2 };
  }

  function clearTree() {
    while (treeGroup.children.length > 0) {
      const child = treeGroup.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
  }

  function addBranch(origin, direction, length, radius, depth, cfg) {
    if (depth <= 0) return;

    const end = origin.clone().add(direction.clone().multiplyScalar(length));
    const geom = new THREE.CylinderGeometry(radius * 0.7, radius, length, 8);
    const mat = new THREE.MeshStandardMaterial({ color: depth < 3 ? 0x3f7f3b : 0x7b4a24, roughness: 0.8 });
    const mesh = new THREE.Mesh(geom, mat);

    mesh.position.copy(origin.clone().add(end).multiplyScalar(0.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    treeGroup.add(mesh);

    const theta = THREE.MathUtils.degToRad(cfg.angleDeg);
    const axisA = new THREE.Vector3(0, 0, 1);
    const axisB = new THREE.Vector3(0, 0, -1);

    const leftDir = direction.clone().applyAxisAngle(axisA, theta).normalize();
    const rightDir = direction.clone().applyAxisAngle(axisB, theta).normalize();
    const upDir = direction.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), theta * 0.5).normalize();

    const nextLen = length * cfg.scale;
    const nextRad = Math.max(0.04, radius * 0.72);

    addBranch(end, leftDir, nextLen, nextRad, depth - 1, cfg);
    addBranch(end, rightDir, nextLen, nextRad, depth - 1, cfg);
    if (depth > 3) {
      addBranch(end, upDir, nextLen * 0.95, nextRad * 0.92, depth - 1, cfg);
    }
  }

  function regenerate() {
    if (building) return;
    building = true;

    const cfg = readControls();
    clearTree();

    const origin = new THREE.Vector3(0, -6, 0);
    const trunkDir = new THREE.Vector3(0, 1, 0);
    addBranch(origin, trunkDir, 4.8, 0.38, cfg.depth, cfg);

    setStatus(`Regenerated at depth ${cfg.depth}.`, "success");
    building = false;
  }

  function resetControls() {
    ui.depth.value = "7";
    ui.angle.value = "24";
    ui.scale.value = "0.69";
    ui.warning.hidden = true;
    regenerate();
    setStatus("Reset to safe defaults.", "neutral");
  }

  document.getElementById("regen").addEventListener("click", regenerate);
  document.getElementById("reset").addEventListener("click", resetControls);
  ui.angle.addEventListener("input", () => {
    ui.angleLabel.textContent = `${clamp(Number(ui.angle.value), LIMITS.angle.min, LIMITS.angle.max).toFixed(0)}°`;
  });
  ui.scale.addEventListener("input", () => {
    ui.scaleLabel.textContent = clamp(Number(ui.scale.value), LIMITS.scale.min, LIMITS.scale.max).toFixed(2);
  });

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  function animate() {
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  window.addEventListener("resize", resize);
  resize();
  regenerate();
  animate();
})();
