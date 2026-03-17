(() => {
  const aInput = document.getElementById("aInput");
  const bInput = document.getElementById("bInput");
  const opSelect = document.getElementById("opSelect");
  const runBtn = document.getElementById("runBtn");
  const statusEl = document.getElementById("status");
  const body = document.getElementById("resultBody");
  const canvas = document.getElementById("plane");
  const ctx = canvas.getContext("2d");
  const LIMIT = 1e6;

  function parseComplex(text) {
    const parts = (text || "").split(",").map((x) => Number(x.trim()));
    if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v))) throw new Error("Use format real,imag.");
    if (parts.some((v) => Math.abs(v) > LIMIT)) throw new Error("Input exceeds bounded range.");
    return { re: parts[0], im: parts[1] };
  }

  function add(a,b){ return { re:a.re+b.re, im:a.im+b.im }; }
  function sub(a,b){ return { re:a.re-b.re, im:a.im-b.im }; }
  function mul(a,b){ return { re:a.re*b.re-a.im*b.im, im:a.re*b.im+a.im*b.re }; }
  function div(a,b){ const d=b.re*b.re+b.im*b.im; if(d===0) throw new Error("Division by zero complex value."); return { re:(a.re*b.re+a.im*b.im)/d, im:(a.im*b.re-a.re*b.im)/d }; }
  function mag(z){ return Math.sqrt(z.re*z.re+z.im*z.im); }
  function arg(z){ return Math.atan2(z.im,z.re); }

  function drawGrid(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="#1f2a44";
    ctx.lineWidth=1;
    const midX=canvas.width/2, midY=canvas.height/2;
    ctx.beginPath(); ctx.moveTo(0,midY); ctx.lineTo(canvas.width,midY); ctx.moveTo(midX,0); ctx.lineTo(midX,canvas.height); ctx.stroke();
  }

  function plot(z, color){
    const scale = 20;
    const x = canvas.width/2 + Math.max(-200, Math.min(200, z.re)) * scale;
    const y = canvas.height/2 - Math.max(-150, Math.min(150, z.im)) * scale;
    ctx.fillStyle=color; ctx.beginPath(); ctx.arc(x,y,5,0,Math.PI*2); ctx.fill();
  }

  function renderTable(a,b,r){
    body.innerHTML="";
    [["A",a],["B",b],["Result",r]].forEach(([label,z])=>{
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${label}</td><td>${z.re.toFixed(6)}</td><td>${z.im.toFixed(6)}</td><td>${mag(z).toFixed(6)}</td><td>${arg(z).toFixed(6)}</td>`;
      body.appendChild(tr);
    });
  }

  runBtn.addEventListener("click", ()=>{
    try{
      const a=parseComplex(aInput.value), b=parseComplex(bInput.value);
      let r;
      if(opSelect.value==="add") r=add(a,b);
      else if(opSelect.value==="sub") r=sub(a,b);
      else if(opSelect.value==="mul") r=mul(a,b);
      else r=div(a,b);
      renderTable(a,b,r);
      drawGrid();
      plot(a,"#60a5fa"); plot(b,"#34d399"); plot(r,"#f59e0b");
      statusEl.textContent = "Computation complete.";
    }catch(err){
      statusEl.textContent = err.message;
      drawGrid();
      body.innerHTML = "";
    }
  });

  drawGrid();
})();
