(() => {
  const startBtn = document.getElementById('start');
  const stopBtn = document.getElementById('stop');
  const gainEl = document.getElementById('gain');
  const statusEl = document.getElementById('status');
  const canvas = document.getElementById('viz');
  const ctx2d = canvas.getContext('2d');
  let audioCtx, analyser, stream, dataArray, raf;

  function draw(){
    if (!analyser) return;
    analyser.getByteFrequencyData(dataArray);
    ctx2d.clearRect(0,0,canvas.width,canvas.height);
    const barW = canvas.width / dataArray.length;
    const sensitivity = Number(gainEl.value) || 1;
    for (let i=0;i<dataArray.length;i++) {
      const v = Math.min(canvas.height, dataArray[i] * sensitivity);
      const x = i * barW;
      ctx2d.fillStyle = `hsl(${(i/dataArray.length)*280+120}, 85%, 55%)`;
      ctx2d.fillRect(x, canvas.height - v, Math.max(1, barW - 1), v);
    }
    raf = requestAnimationFrame(draw);
  }

  async function start(){
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioCtx = new (window.AudioContext||window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      statusEl.textContent = 'Microphone active.';
      draw();
    } catch (e) {
      statusEl.textContent = 'Microphone unavailable or permission denied.';
    }
  }

  function stop(){
    cancelAnimationFrame(raf);
    if (stream) stream.getTracks().forEach(t=>t.stop());
    if (audioCtx) audioCtx.close();
    stream = null; analyser = null; audioCtx = null;
    ctx2d.clearRect(0,0,canvas.width,canvas.height);
    statusEl.textContent = 'Stopped.';
  }

  startBtn.addEventListener('click', start);
  stopBtn.addEventListener('click', stop);
})();
