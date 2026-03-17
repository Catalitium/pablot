(() => {
  const canvas = document.getElementById("scene");
  const ctx = canvas.getContext("2d");

  const timeScaleInput = document.getElementById("timeScale");
  const timeScaleLabel = document.getElementById("timeScaleLabel");
  const status = document.getElementById("status");
  const planetName = document.getElementById("planetName");
  const planetData = document.getElementById("planetData");

  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  const planets = [
    { name: "Mercury", radius: 4, orbit: 45, speed: 4.15, color: "#cbd5e1", info: "Fast inner orbit." },
    { name: "Venus", radius: 6, orbit: 70, speed: 1.62, color: "#f59e0b", info: "Dense atmosphere." },
    { name: "Earth", radius: 6, orbit: 95, speed: 1.0, color: "#38bdf8", info: "Reference orbital ratio 1.0." },
    { name: "Mars", radius: 5, orbit: 125, speed: 0.53, color: "#f97316", info: "Cold desert world." },
    { name: "Jupiter", radius: 11, orbit: 170, speed: 0.084, color: "#fcd34d", info: "Largest planet in model." },
    { name: "Saturn", radius: 10, orbit: 210, speed: 0.034, color: "#fde68a", info: "Rendered with ring accent." },
    { name: "Uranus", radius: 8, orbit: 250, speed: 0.012, color: "#7dd3fc", info: "High axial tilt omitted in simplified model." },
    { name: "Neptune", radius: 8, orbit: 290, speed: 0.006, color: "#60a5fa", info: "Outer orbit with slow ratio." }
  ].map((p, i) => ({ ...p, angle: i * 0.65, sx: 0, sy: 0 }));

  let width = 0;
  let height = 0;
  let paused = false;
  let selected = null;

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function setStatus(msg) {
    status.textContent = msg;
  }

  function drawScene(dt) {
    const cx = width / 2;
    const cy = height / 2;
    const baseScale = Math.min(width, height) / 760;

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < 350; i += 1) {
      const sx = (i * 97) % width;
      const sy = (i * 57) % height;
      ctx.fillStyle = `rgba(255,255,255,${0.15 + ((i % 5) * 0.12)})`;
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(cx, cy, 14 * baseScale, 0, Math.PI * 2);
    ctx.fill();

    const ts = clamp(Number(timeScaleInput.value), 0.1, 5);
    timeScaleInput.value = String(ts);
    timeScaleLabel.textContent = `${ts.toFixed(1)}x`;

    planets.forEach((planet) => {
      if (!paused) {
        planet.angle += dt * ts * planet.speed;
      }

      const orbit = planet.orbit * baseScale;
      planet.sx = cx + Math.cos(planet.angle) * orbit;
      planet.sy = cy + Math.sin(planet.angle) * orbit;

      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.beginPath();
      ctx.arc(cx, cy, orbit, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = planet.color;
      ctx.beginPath();
      ctx.arc(planet.sx, planet.sy, planet.radius * baseScale, 0, Math.PI * 2);
      ctx.fill();

      if (planet.name === "Saturn") {
        ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(planet.sx, planet.sy, 15 * baseScale, 7 * baseScale, 0.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }

      if (selected && selected.name === planet.name) {
        ctx.strokeStyle = "#93c5fd";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(planet.sx, planet.sy, (planet.radius + 4) * baseScale, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    });
  }

  function pickPlanet(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const hit = planets.find((planet) => {
      const dx = x - planet.sx;
      const dy = y - planet.sy;
      return Math.hypot(dx, dy) <= Math.max(10, planet.radius + 6);
    });

    if (!hit) {
      selected = null;
      planetName.textContent = "No planet selected";
      planetData.textContent = "Tap/click a planet to view details.";
      return;
    }

    selected = hit;
    planetName.textContent = hit.name;
    planetData.textContent = `Orbit ratio: ${hit.speed.toFixed(3)} | ${hit.info}`;
  }

  document.getElementById("pauseBtn").addEventListener("click", () => {
    paused = true;
    setStatus("Paused.");
  });

  document.getElementById("resumeBtn").addEventListener("click", () => {
    paused = false;
    setStatus("Running.");
  });

  timeScaleInput.addEventListener("input", () => {
    const ts = clamp(Number(timeScaleInput.value), 0.1, 5);
    timeScaleInput.value = String(ts);
    timeScaleLabel.textContent = `${ts.toFixed(1)}x`;
  });

  canvas.addEventListener("click", (e) => pickPlanet(e.clientX, e.clientY));
  canvas.addEventListener("touchstart", (e) => {
    const t = e.changedTouches[0];
    if (t) pickPlanet(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener("resize", resize);

  let last = performance.now();
  function animate(now) {
    const dt = Math.max(0.001, (now - last) / 1000);
    last = now;
    drawScene(dt);
    requestAnimationFrame(animate);
  }

  resize();
  setStatus("Running.");
  requestAnimationFrame(animate);
})();
