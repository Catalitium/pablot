(() => {
  const numInput = document.getElementById("numInput");
  const denInput = document.getElementById("denInput");
  const runBtn = document.getElementById("runBtn");
  const statusEl = document.getElementById("status");
  const pz = document.getElementById("pzCanvas").getContext("2d");
  const rc = document.getElementById("respCanvas").getContext("2d");

  const MAX_ORDER = 2;
  const SAMPLE_COUNT = 220;
  const DT = 0.04;

  function parseCoeffs(text) {
    const arr = (text || "").split(",").map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v));
    if (!arr.length) throw new Error("Coefficient list cannot be empty.");
    if (arr.length - 1 > MAX_ORDER) throw new Error(`Order above cap (${MAX_ORDER}) is not supported.`);
    return arr;
  }

  function quadraticRoots(a,b,c){
    if (Math.abs(a) < 1e-12) {
      if (Math.abs(b) < 1e-12) return [];
      return [{re:-c/b,im:0}];
    }
    const d = b*b - 4*a*c;
    if (d >= 0) {
      const s = Math.sqrt(d);
      return [{re:(-b+s)/(2*a),im:0},{re:(-b-s)/(2*a),im:0}];
    }
    const s = Math.sqrt(-d);
    return [{re:-b/(2*a),im:s/(2*a)},{re:-b/(2*a),im:-s/(2*a)}];
  }

  function drawPZ(roots) {
    const c = pz.canvas;
    pz.clearRect(0,0,c.width,c.height);
    pz.strokeStyle="#223452";
    pz.beginPath();
    pz.moveTo(0,c.height/2); pz.lineTo(c.width,c.height/2);
    pz.moveTo(c.width/2,0); pz.lineTo(c.width/2,c.height);
    pz.stroke();
    const scale = 35;
    roots.forEach((r)=>{
      const x = c.width/2 + r.re * scale;
      const y = c.height/2 - r.im * scale;
      pz.strokeStyle="#ef4444";
      pz.beginPath(); pz.moveTo(x-6,y-6); pz.lineTo(x+6,y+6); pz.moveTo(x+6,y-6); pz.lineTo(x-6,y+6); pz.stroke();
    });
  }

  function stepResponse(num, den) {
    const y = [];
    let y1 = 0, y2 = 0;
    const a0 = den[0] ?? 1;
    const a1 = den[1] ?? 0;
    const a2 = den[2] ?? 0;
    const b0 = num[0] ?? 0;
    for (let k=0;k<SAMPLE_COUNT;k++) {
      const u = 1;
      const next = (b0*u - a1*y1 - a2*y2) / a0;
      y.push(next);
      y2 = y1;
      y1 = next;
    }
    return y;
  }

  function drawResponse(values) {
    const c = rc.canvas;
    rc.clearRect(0,0,c.width,c.height);
    const min = Math.min(...values, -0.2);
    const max = Math.max(...values, 1);
    rc.beginPath();
    values.forEach((v,i)=>{
      const x = (i/(values.length-1))*c.width;
      const y = c.height - ((v-min)/(max-min+1e-9))*c.height;
      if(i===0) rc.moveTo(x,y); else rc.lineTo(x,y);
    });
    rc.strokeStyle="#34d399";
    rc.lineWidth=2;
    rc.stroke();
  }

  runBtn.addEventListener("click", ()=>{
    try {
      const num = parseCoeffs(numInput.value);
      const den = parseCoeffs(denInput.value);
      if (Math.abs(den[0]) < 1e-12) throw new Error("Leading denominator coefficient cannot be zero.");
      const roots = den.length === 3 ? quadraticRoots(den[0], den[1], den[2]) : quadraticRoots(0, den[0], den[1] ?? 0);
      drawPZ(roots);
      drawResponse(stepResponse(num, den));
      statusEl.textContent = `Rendered with deterministic sampling (N=${SAMPLE_COUNT}, dt=${DT}).`;
    } catch (err) {
      statusEl.textContent = err.message;
      pz.clearRect(0,0,pz.canvas.width,pz.canvas.height);
      rc.clearRect(0,0,rc.canvas.width,rc.canvas.height);
    }
  });
})();
