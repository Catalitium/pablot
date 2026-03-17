(() => {
  const presets = {
    sunset: [ ["#ff7e5f", 0], ["#feb47b", 100] ],
    ocean: [ ["#2193b0", 0], ["#6dd5ed", 100] ],
    violet: [ ["#8e2de2", 0], ["#4a00e0", 100] ]
  };
  const typeEl = document.getElementById("type");
  const angleEl = document.getElementById("angle");
  const presetEl = document.getElementById("preset");
  const stopsEl = document.getElementById("stops");
  const previewEl = document.getElementById("preview");
  const outputEl = document.getElementById("output");
  const statusEl = document.getElementById("status");
  let stops = [["#ff7e5f",0],["#feb47b",100]];

  Object.keys(presets).forEach((k)=>{
    const o=document.createElement("option");o.value=k;o.textContent=k;presetEl.appendChild(o);
  });

  function renderStops(){
    stopsEl.innerHTML="";
    stops.forEach((s,i)=>{
      const row=document.createElement("div"); row.className="stop-row";
      row.innerHTML=`<input type="color" data-kind="color" data-i="${i}" value="${s[0]}"><input type="number" min="0" max="100" data-kind="pos" data-i="${i}" value="${s[1]}"><button type="button" data-kind="del" data-i="${i}">Remove</button>`;
      stopsEl.appendChild(row);
    });
  }

  function cssValue(){
    if (stops.length < 2) throw new Error("At least two color stops are required.");
    const normalized = stops.map(([c,p])=>[c,Math.max(0,Math.min(100,Number(p)||0))]);
    normalized.sort((a,b)=>a[1]-b[1]);
    const list = normalized.map(([c,p])=>`${c} ${p}%`).join(", ");
    return typeEl.value === "linear" ? `linear-gradient(${Number(angleEl.value)||0}deg, ${list})` : `radial-gradient(circle, ${list})`;
  }

  function update(){
    try {
      const css = cssValue();
      previewEl.style.background = css;
      outputEl.textContent = `background: ${css};`;
      statusEl.textContent = "Gradient ready.";
      statusEl.style.color = "#067647";
    } catch (e) {
      outputEl.textContent = "";
      statusEl.textContent = e.message;
      statusEl.style.color = "#b42318";
    }
  }

  stopsEl.addEventListener("input", (e)=>{
    const i=Number(e.target.dataset.i);
    const kind=e.target.dataset.kind;
    if (kind==="color") stops[i][0]=e.target.value;
    if (kind==="pos") stops[i][1]=Number(e.target.value);
    update();
  });

  stopsEl.addEventListener("click", (e)=>{
    if (e.target.dataset.kind==="del") {
      stops.splice(Number(e.target.dataset.i),1);
      renderStops(); update();
    }
  });

  document.getElementById("addStop").addEventListener("click", ()=>{ stops.push(["#ffffff",50]); renderStops(); update(); });
  presetEl.addEventListener("change", ()=>{ stops = presets[presetEl.value].map(x=>[x[0],x[1]]); renderStops(); update(); });
  typeEl.addEventListener("change", update);
  angleEl.addEventListener("input", update);

  document.getElementById("copyCss").addEventListener("click", async ()=>{
    const text=outputEl.textContent;
    if(!text) return;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else { const ta=document.createElement("textarea"); ta.value=text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      statusEl.textContent="CSS copied."; statusEl.style.color="#067647";
    } catch { statusEl.textContent="Copy failed in this browser context."; statusEl.style.color="#b42318"; }
  });

  presetEl.value="sunset";
  renderStops();
  update();
})();
