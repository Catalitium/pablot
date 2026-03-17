(() => {
  const canvas = document.getElementById("plotCanvas");
  const ctx = canvas.getContext("2d");
  const expressionInput = document.getElementById("expression");
  const status = document.getElementById("status");
  const rootResult = document.getElementById("rootResult");

  const constants = {
    pi: Math.PI,
    e: Math.E
  };

  const functions = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    log: (v) => Math.log10(v),
    ln: (v) => Math.log(v),
    sqrt: Math.sqrt,
    abs: Math.abs
  };

  const precedence = {
    "+": 1,
    "-": 1,
    "*": 2,
    "/": 2,
    "^": 3
  };

  const rightAssociative = new Set(["^"]);
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const view = {
    xMin: -10,
    xMax: 10,
    yMin: -10,
    yMax: 10
  };

  let compiled = null;

  function setStatus(message, type) {
    status.textContent = message;
    status.className = `status ${type}`;
  }

  function setRoot(message, type) {
    rootResult.textContent = message;
    rootResult.className = `status ${type}`;
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(300, Math.floor(rect.width));
    canvas.height = Math.max(240, Math.floor(rect.height));
    render();
  }

  function worldToCanvas(x, y) {
    const px = ((x - view.xMin) / (view.xMax - view.xMin)) * canvas.width;
    const py = canvas.height - ((y - view.yMin) / (view.yMax - view.yMin)) * canvas.height;
    return { px, py };
  }

  function canvasToWorld(px, py) {
    const x = view.xMin + (px / canvas.width) * (view.xMax - view.xMin);
    const y = view.yMin + ((canvas.height - py) / canvas.height) * (view.yMax - view.yMin);
    return { x, y };
  }

  function drawAxes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = "#d3dae8";
    ctx.lineWidth = 1;

    const spanX = view.xMax - view.xMin;
    const spanY = view.yMax - view.yMin;
    const stepX = chooseGridStep(spanX);
    const stepY = chooseGridStep(spanY);

    for (let gx = Math.ceil(view.xMin / stepX) * stepX; gx <= view.xMax; gx += stepX) {
      const { px } = worldToCanvas(gx, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }

    for (let gy = Math.ceil(view.yMin / stepY) * stepY; gy <= view.yMax; gy += stepY) {
      const { py } = worldToCanvas(0, gy);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }

    ctx.strokeStyle = "#445274";
    ctx.lineWidth = 1.5;

    if (view.yMin <= 0 && view.yMax >= 0) {
      const { py } = worldToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvas.width, py);
      ctx.stroke();
    }

    if (view.xMin <= 0 && view.xMax >= 0) {
      const { px } = worldToCanvas(0, 0);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvas.height);
      ctx.stroke();
    }
  }

  function chooseGridStep(span) {
    const targetLines = 10;
    const raw = span / targetLines;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const ratios = [1, 2, 5, 10];
    for (const ratio of ratios) {
      const step = ratio * mag;
      if (raw <= step) return step;
    }
    return 10 * mag;
  }

  function tokenize(expr) {
    const tokens = [];
    const text = expr.replace(/\s+/g, "").toLowerCase();
    let i = 0;

    while (i < text.length) {
      const ch = text[i];

      if (/[0-9.]/.test(ch)) {
        let j = i + 1;
        while (j < text.length && /[0-9.]/.test(text[j])) j += 1;
        const numText = text.slice(i, j);
        if ((numText.match(/\./g) || []).length > 1) {
          throw new Error(`Invalid number '${numText}'`);
        }
        tokens.push({ type: "number", value: Number(numText) });
        i = j;
        continue;
      }

      if (/[a-z]/.test(ch)) {
        let j = i + 1;
        while (j < text.length && /[a-z]/.test(text[j])) j += 1;
        const word = text.slice(i, j);

        if (word === "x") {
          tokens.push({ type: "variable", value: "x" });
        } else if (word in constants) {
          tokens.push({ type: "number", value: constants[word] });
        } else if (word in functions) {
          tokens.push({ type: "function", value: word });
        } else {
          throw new Error(`Unsupported token '${word}'`);
        }

        i = j;
        continue;
      }

      if ("+-*/^()".includes(ch)) {
        if (ch === "(" || ch === ")") {
          tokens.push({ type: "paren", value: ch });
        } else {
          tokens.push({ type: "operator", value: ch });
        }
        i += 1;
        continue;
      }

      throw new Error(`Unsupported token '${ch}'`);
    }

    return tokens;
  }

  function toRpn(tokens) {
    const output = [];
    const stack = [];
    let previous = null;

    for (const token of tokens) {
      if (token.type === "number" || token.type === "variable") {
        output.push(token);
      } else if (token.type === "function") {
        stack.push(token);
      } else if (token.type === "operator") {
        const unary = token.value === "-" && (!previous || (previous.type === "operator") || (previous.type === "paren" && previous.value === "("));
        const op = unary ? { type: "function", value: "neg" } : token;

        if (op.type === "function") {
          stack.push(op);
        } else {
          while (stack.length > 0) {
            const top = stack[stack.length - 1];
            if (top.type === "function") {
              output.push(stack.pop());
              continue;
            }
            if (top.type !== "operator") break;

            const left = precedence[top.value] > precedence[op.value];
            const same = precedence[top.value] === precedence[op.value];
            const shouldPop = left || (same && !rightAssociative.has(op.value));
            if (!shouldPop) break;
            output.push(stack.pop());
          }
          stack.push(op);
        }
      } else if (token.type === "paren" && token.value === "(") {
        stack.push(token);
      } else if (token.type === "paren" && token.value === ")") {
        let foundLeft = false;
        while (stack.length > 0) {
          const top = stack.pop();
          if (top.type === "paren" && top.value === "(") {
            foundLeft = true;
            break;
          }
          output.push(top);
        }
        if (!foundLeft) throw new Error("Mismatched parentheses");
        if (stack.length > 0 && stack[stack.length - 1].type === "function") {
          output.push(stack.pop());
        }
      }
      previous = token;
    }

    while (stack.length > 0) {
      const top = stack.pop();
      if (top.type === "paren") throw new Error("Mismatched parentheses");
      output.push(top);
    }

    return output;
  }

  function evalRpn(rpn, xValue) {
    const st = [];

    for (const token of rpn) {
      if (token.type === "number") {
        st.push(token.value);
      } else if (token.type === "variable") {
        st.push(xValue);
      } else if (token.type === "operator") {
        const b = st.pop();
        const a = st.pop();
        if (a === undefined || b === undefined) throw new Error("Malformed expression");
        if (token.value === "+") st.push(a + b);
        if (token.value === "-") st.push(a - b);
        if (token.value === "*") st.push(a * b);
        if (token.value === "/") st.push(a / b);
        if (token.value === "^") st.push(Math.pow(a, b));
      } else if (token.type === "function") {
        const v = st.pop();
        if (v === undefined) throw new Error("Malformed expression");
        if (token.value === "neg") {
          st.push(-v);
        } else {
          st.push(functions[token.value](v));
        }
      }
    }

    if (st.length !== 1) throw new Error("Malformed expression");
    return st[0];
  }

  function compileExpression(expr) {
    const tokens = tokenize(expr);
    if (tokens.length === 0) throw new Error("Expression is empty");
    const rpn = toRpn(tokens);
    return {
      evalAt: (x) => evalRpn(rpn, x)
    };
  }

  function isFiniteNumber(v) {
    return Number.isFinite(v) && !Number.isNaN(v);
  }

  function renderCurve() {
    if (!compiled) return;

    const samples = 1200;
    const dx = (view.xMax - view.xMin) / samples;

    ctx.strokeStyle = "#1f5acc";
    ctx.lineWidth = 2;
    ctx.beginPath();
    let drawing = false;

    for (let i = 0; i <= samples; i += 1) {
      const x = view.xMin + dx * i;
      let y;

      try {
        y = compiled.evalAt(x);
      } catch {
        drawing = false;
        continue;
      }

      if (!isFiniteNumber(y)) {
        drawing = false;
        continue;
      }

      if (Math.abs(y) > 1e6) {
        drawing = false;
        continue;
      }

      const { px, py } = worldToCanvas(x, y);
      if (!isFiniteNumber(px) || !isFiniteNumber(py) || py < -5000 || py > canvas.height + 5000) {
        drawing = false;
        continue;
      }

      if (!drawing) {
        ctx.moveTo(px, py);
        drawing = true;
      } else {
        ctx.lineTo(px, py);
      }
    }

    ctx.stroke();
  }

  function render() {
    drawAxes();
    renderCurve();
  }

  function pan(dxFactor, dyFactor) {
    const spanX = view.xMax - view.xMin;
    const spanY = view.yMax - view.yMin;
    const dx = spanX * dxFactor;
    const dy = spanY * dyFactor;
    view.xMin += dx;
    view.xMax += dx;
    view.yMin += dy;
    view.yMax += dy;
    render();
  }

  function zoom(scale) {
    const centerX = (view.xMin + view.xMax) / 2;
    const centerY = (view.yMin + view.yMax) / 2;
    const halfX = ((view.xMax - view.xMin) * scale) / 2;
    const halfY = ((view.yMax - view.yMin) * scale) / 2;
    view.xMin = centerX - halfX;
    view.xMax = centerX + halfX;
    view.yMin = centerY - halfY;
    view.yMax = centerY + halfY;
    render();
  }

  function resetView() {
    view.xMin = -10;
    view.xMax = 10;
    view.yMin = -10;
    view.yMax = 10;
    render();
  }

  function approximateRoot() {
    if (!compiled) {
      setRoot("Plot a valid expression before root approximation.", "error");
      return;
    }

    const scanCount = 250;
    const maxIter = 70;
    const tol = 1e-6;
    const xStart = view.xMin;
    const xEnd = view.xMax;
    const step = (xEnd - xStart) / scanCount;

    let best = null;

    for (let i = 0; i < scanCount; i += 1) {
      const a = xStart + i * step;
      const b = a + step;
      let fa;
      let fb;
      try {
        fa = compiled.evalAt(a);
        fb = compiled.evalAt(b);
      } catch {
        continue;
      }
      if (!isFiniteNumber(fa) || !isFiniteNumber(fb)) continue;

      if (Math.abs(fa) < tol) {
        best = { x: a, y: fa, iterations: 0 };
        break;
      }

      if (fa * fb > 0) continue;

      let left = a;
      let right = b;
      let fLeft = fa;
      let fRight = fb;
      let mid = left;
      let fMid = fLeft;
      let iter = 0;

      while (iter < maxIter) {
        mid = (left + right) / 2;
        fMid = compiled.evalAt(mid);
        if (!isFiniteNumber(fMid)) break;
        if (Math.abs(fMid) <= tol || Math.abs(right - left) <= tol) break;

        if (fLeft * fMid <= 0) {
          right = mid;
          fRight = fMid;
        } else {
          left = mid;
          fLeft = fMid;
        }
        iter += 1;
      }

      if (isFiniteNumber(fMid)) {
        best = { x: mid, y: fMid, iterations: iter };
        break;
      }
    }

    if (!best) {
      setRoot("No sign-change interval found in current view.", "error");
      return;
    }

    setRoot(`x ≈ ${best.x.toFixed(6)}, f(x) ≈ ${best.y.toExponential(2)} (iters: ${best.iterations})`, "success");
  }

  function onPlot() {
    try {
      compiled = compileExpression(expressionInput.value);
      setStatus("Expression parsed successfully.", "success");
      setRoot("No root computed yet.", "neutral");
      render();
    } catch (err) {
      compiled = null;
      render();
      setStatus(String(err.message || err), "error");
      setRoot("Root unavailable due to validation error.", "error");
    }
  }

  document.getElementById("plotBtn").addEventListener("click", onPlot);
  document.getElementById("resetBtn").addEventListener("click", () => {
    resetView();
    setStatus("View reset.", "neutral");
  });
  document.getElementById("zoomInBtn").addEventListener("click", () => zoom(0.8));
  document.getElementById("zoomOutBtn").addEventListener("click", () => zoom(1.25));
  document.getElementById("panLeftBtn").addEventListener("click", () => pan(-0.1, 0));
  document.getElementById("panRightBtn").addEventListener("click", () => pan(0.1, 0));
  document.getElementById("panUpBtn").addEventListener("click", () => pan(0, 0.1));
  document.getElementById("panDownBtn").addEventListener("click", () => pan(0, -0.1));
  document.getElementById("rootBtn").addEventListener("click", approximateRoot);

  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    const zoomFactor = event.deltaY < 0 ? 0.92 : 1.08;
    const { x: worldX, y: worldY } = canvasToWorld(event.offsetX, event.offsetY);

    view.xMin = worldX + (view.xMin - worldX) * zoomFactor;
    view.xMax = worldX + (view.xMax - worldX) * zoomFactor;
    view.yMin = worldY + (view.yMin - worldY) * zoomFactor;
    view.yMax = worldY + (view.yMax - worldY) * zoomFactor;

    const minSpan = 0.01;
    const maxSpan = 1e4;
    const spanX = clamp(view.xMax - view.xMin, minSpan, maxSpan);
    const spanY = clamp(view.yMax - view.yMin, minSpan, maxSpan);
    const centerX = (view.xMax + view.xMin) / 2;
    const centerY = (view.yMax + view.yMin) / 2;
    view.xMin = centerX - spanX / 2;
    view.xMax = centerX + spanX / 2;
    view.yMin = centerY - spanY / 2;
    view.yMax = centerY + spanY / 2;

    render();
  }, { passive: false });

  let dragging = false;
  let lastMouse = null;

  canvas.addEventListener("mousedown", (e) => {
    dragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener("mouseup", () => {
    dragging = false;
    lastMouse = null;
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging || !lastMouse) return;
    const dxPx = e.clientX - lastMouse.x;
    const dyPx = e.clientY - lastMouse.y;

    const dxWorld = -(dxPx / canvas.width) * (view.xMax - view.xMin);
    const dyWorld = (dyPx / canvas.height) * (view.yMax - view.yMin);
    view.xMin += dxWorld;
    view.xMax += dxWorld;
    view.yMin += dyWorld;
    view.yMax += dyWorld;

    lastMouse = { x: e.clientX, y: e.clientY };
    render();
  });

  window.addEventListener("resize", resizeCanvas);

  resizeCanvas();
  onPlot();
})();
