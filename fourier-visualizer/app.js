(() => {
  const fixtureSelect = document.getElementById("fixtureSelect");
  const loadBtn = document.getElementById("loadBtn");
  const loadParityBtn = document.getElementById("loadParityBtn");
  const statusEl = document.getElementById("status");
  const waveCanvas = document.getElementById("waveCanvas");
  const specCanvas = document.getElementById("specCanvas");
  const dominantOut = document.getElementById("dominantOut");
  const parityTable = document.getElementById("parityTable");
  const parityBody = document.querySelector("#parityTable tbody");

  let fixtureMap = new Map();

  function dft(samples, sampleRate) {
    const N = samples.length;
    const bins = Math.floor(N / 2);
    const out = [];
    for (let k = 0; k < bins; k += 1) {
      let re = 0;
      let im = 0;
      for (let n = 0; n < N; n += 1) {
        const angle = -2 * Math.PI * k * n / N;
        re += samples[n] * Math.cos(angle);
        im += samples[n] * Math.sin(angle);
      }
      const amp = Math.sqrt(re * re + im * im) / N;
      out.push({ frequency: Number((k * sampleRate / N).toFixed(6)), amplitude: Number(amp.toFixed(12)) });
    }
    return out;
  }

  function drawWave(samples) {
    const ctx = waveCanvas.getContext("2d");
    ctx.clearRect(0,0,waveCanvas.width,waveCanvas.height);
    ctx.beginPath();
    samples.forEach((v, i) => {
      const x = i / (samples.length - 1) * waveCanvas.width;
      const y = waveCanvas.height / 2 - v * (waveCanvas.height * 0.4);
      if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function drawSpectrum(spec) {
    const ctx = specCanvas.getContext("2d");
    ctx.clearRect(0,0,specCanvas.width,specCanvas.height);
    const maxAmp = Math.max(...spec.map((x) => x.amplitude), 1e-12);
    const barW = specCanvas.width / spec.length;
    spec.forEach((b, i) => {
      const h = b.amplitude / maxAmp * (specCanvas.height - 8);
      ctx.fillStyle = "#34d399";
      ctx.fillRect(i * barW, specCanvas.height - h, Math.max(1, barW - 1), h);
    });
  }

  function dominant(spec, topN) {
    return [...spec].sort((a,b) => b.amplitude - a.amplitude).slice(0, topN);
  }

  async function loadFixtures() {
    const res = await fetch("compute/fixtures/signals.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Missing compute/fixtures/signals.json");
    const payload = await res.json();
    const signals = Array.isArray(payload.signals) ? payload.signals : [];
    signals.forEach((s) => {
      fixtureMap.set(s.id, s);
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = `${s.id} (${s.label})`;
      fixtureSelect.appendChild(opt);
    });
  }

  loadBtn.addEventListener("click", () => {
    const sel = fixtureMap.get(fixtureSelect.value);
    if (!sel) return;
    const spec = dft(sel.samples, sel.sample_rate);
    drawWave(sel.samples);
    drawSpectrum(spec);
    dominantOut.textContent = JSON.stringify({ top_bins: dominant(spec, 5), expected_dominant_hz: sel.expected_dominant_hz }, null, 2);
    statusEl.textContent = `Rendered fixture ${sel.id}.`;
  });

  function chip(status) {
    const safe = status === "pass" ? "pass" : "blocked";
    return `<span class="chip ${safe}">${safe}</span>`;
  }

  loadParityBtn.addEventListener("click", async () => {
    parityBody.innerHTML = "";
    try {
      const res = await fetch("compute/output/parity-benchmark-report.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Run compute/run-parity.ps1 to generate parity report.");
      const report = await res.json();
      const list = Array.isArray(report.cases) ? report.cases : [];
      if (!list.length) throw new Error("Parity report contains no cases.");
      parityTable.hidden = false;
      list.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${c.case_id}</td><td>${c.python_status}</td><td>${c.cpp_status}</td><td>${c.max_amp_diff}</td><td>${chip(c.parity_status)}</td>`;
        parityBody.appendChild(tr);
      });
      statusEl.textContent = `Loaded parity report (${report.overall_status}).`;
    } catch (err) {
      parityTable.hidden = true;
      statusEl.textContent = err.message;
    }
  });

  loadFixtures().then(() => {
    if (fixtureSelect.options.length > 0) fixtureSelect.selectedIndex = 0;
  }).catch((err) => {
    statusEl.textContent = err.message;
  });
})();
