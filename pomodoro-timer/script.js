(() => {
  const KEY = "pomodoro-settings";
  const modeEl = document.getElementById("mode");
  const timeEl = document.getElementById("time");
  const cycleEl = document.getElementById("cycle");
  const statusEl = document.getElementById("status");
  const inputs = {
    work: document.getElementById("work"),
    short: document.getElementById("short"),
    long: document.getElementById("long"),
    interval: document.getElementById("interval")
  };

  let state = { phase: "work", cycle: 1, remaining: 25 * 60, running: false, timerId: null };

  function settings() {
    return {
      work: Number(inputs.work.value) || 25,
      short: Number(inputs.short.value) || 5,
      long: Number(inputs.long.value) || 15,
      interval: Number(inputs.interval.value) || 4
    };
  }

  function applyStored() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) || "{}");
      ["work","short","long","interval"].forEach((k)=>{ if (s[k]) inputs[k].value = s[k]; });
    } catch {}
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  function phaseDuration(phase) {
    const s = settings();
    if (phase === "work") return s.work * 60;
    if (phase === "short") return s.short * 60;
    return s.long * 60;
  }

  function notifyPhase() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = 740; g.gain.value = 0.04;
      o.start(); setTimeout(()=>{o.stop(); ctx.close();}, 180);
    } catch {}

    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Pomodoro", { body: `Switched to ${state.phase} phase.` });
    }
  }

  function switchPhase() {
    const s = settings();
    if (state.phase === "work") {
      if (state.cycle % s.interval === 0) state.phase = "long";
      else state.phase = "short";
    } else {
      state.phase = "work";
      state.cycle += 1;
    }
    state.remaining = phaseDuration(state.phase);
    notifyPhase();
  }

  function render() {
    modeEl.textContent = state.phase === "work" ? "Work" : state.phase === "short" ? "Short Break" : "Long Break";
    timeEl.textContent = fmt(state.remaining);
    cycleEl.textContent = String(state.cycle);
  }

  function tick() {
    if (!state.running) return;
    state.remaining -= 1;
    if (state.remaining <= 0) switchPhase();
    render();
  }

  document.getElementById("start").addEventListener("click", async () => {
    if ("Notification" in window && Notification.permission === "default") {
      try { await Notification.requestPermission(); } catch {}
    }
    if (!state.running) {
      state.running = true;
      state.timerId = setInterval(tick, 1000);
      statusEl.textContent = "Timer running.";
    }
  });

  document.getElementById("pause").addEventListener("click", () => {
    state.running = false;
    clearInterval(state.timerId);
    statusEl.textContent = "Timer paused.";
  });

  document.getElementById("reset").addEventListener("click", () => {
    state.running = false;
    clearInterval(state.timerId);
    state.phase = "work";
    state.remaining = phaseDuration("work");
    render();
    statusEl.textContent = "Timer reset to work phase.";
  });

  document.getElementById("save").addEventListener("click", () => {
    const s = settings();
    localStorage.setItem(KEY, JSON.stringify(s));
    if (!state.running) {
      state.remaining = phaseDuration(state.phase);
      render();
    }
    statusEl.textContent = "Settings saved.";
  });

  applyStored();
  state.remaining = phaseDuration("work");
  render();
})();
