(() => {
  const MAX_DIM = 6;

  const el = {
    rowsA: document.getElementById("rowsA"),
    colsA: document.getElementById("colsA"),
    rowsB: document.getElementById("rowsB"),
    colsB: document.getElementById("colsB"),
    resizeBtn: document.getElementById("resizeBtn"),
    computeBtn: document.getElementById("computeBtn"),
    operation: document.getElementById("operation"),
    matrixA: document.getElementById("matrixA"),
    matrixB: document.getElementById("matrixB"),
    result: document.getElementById("result"),
    status: document.getElementById("status")
  };

  let dims = { a: { r: 2, c: 2 }, b: { r: 2, c: 2 } };

  function setStatus(message, type) {
    el.status.textContent = message;
    el.status.className = `status ${type}`;
  }

  function clampDim(v) {
    const num = Number(v);
    if (!Number.isFinite(num)) return 1;
    return Math.min(MAX_DIM, Math.max(1, Math.floor(num)));
  }

  function buildGrid(host, rows, cols) {
    host.innerHTML = "";
    host.style.gridTemplateColumns = `repeat(${cols}, minmax(2.8rem, 1fr))`;
    for (let i = 0; i < rows * cols; i += 1) {
      const input = document.createElement("input");
      input.type = "text";
      input.value = "0";
      input.dataset.idx = String(i);
      host.appendChild(input);
    }
  }

  function readMatrix(host, rows, cols, name) {
    const values = [];
    const inputs = Array.from(host.querySelectorAll("input"));
    for (let r = 0; r < rows; r += 1) {
      const row = [];
      for (let c = 0; c < cols; c += 1) {
        const raw = inputs[r * cols + c].value.trim();
        const num = Number(raw);
        if (!Number.isFinite(num)) {
          throw new Error(`Malformed numeric input in ${name}[${r + 1},${c + 1}]`);
        }
        row.push(num);
      }
      values.push(row);
    }
    return values;
  }

  function sameDims(a, b) {
    return a.length === b.length && a[0].length === b[0].length;
  }

  function add(a, b, sign = 1) {
    return a.map((row, r) => row.map((v, c) => v + sign * b[r][c]));
  }

  function multiply(a, b) {
    const out = Array.from({ length: a.length }, () => Array.from({ length: b[0].length }, () => 0));
    for (let r = 0; r < a.length; r += 1) {
      for (let c = 0; c < b[0].length; c += 1) {
        let sum = 0;
        for (let k = 0; k < a[0].length; k += 1) {
          sum += a[r][k] * b[k][c];
        }
        out[r][c] = sum;
      }
    }
    return out;
  }

  function transpose(m) {
    return m[0].map((_, c) => m.map((row) => row[c]));
  }

  function determinant(m) {
    const n = m.length;
    if (n !== m[0].length) throw new Error("Dimension mismatch: determinant requires a square matrix");
    const a = m.map((row) => [...row]);
    let det = 1;

    for (let i = 0; i < n; i += 1) {
      let pivot = i;
      for (let r = i + 1; r < n; r += 1) {
        if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
      }
      if (Math.abs(a[pivot][i]) < 1e-12) return 0;
      if (pivot !== i) {
        [a[i], a[pivot]] = [a[pivot], a[i]];
        det *= -1;
      }
      det *= a[i][i];
      const pivotValue = a[i][i];
      for (let r = i + 1; r < n; r += 1) {
        const factor = a[r][i] / pivotValue;
        for (let c = i; c < n; c += 1) {
          a[r][c] -= factor * a[i][c];
        }
      }
    }

    return det;
  }

  function inverse(m) {
    const n = m.length;
    if (n !== m[0].length) throw new Error("Dimension mismatch: inverse requires a square matrix");

    const a = m.map((row, r) => [
      ...row,
      ...Array.from({ length: n }, (_, c) => (r === c ? 1 : 0))
    ]);

    for (let i = 0; i < n; i += 1) {
      let pivot = i;
      for (let r = i + 1; r < n; r += 1) {
        if (Math.abs(a[r][i]) > Math.abs(a[pivot][i])) pivot = r;
      }
      if (Math.abs(a[pivot][i]) < 1e-12) throw new Error("Singular matrix: inverse unavailable");

      if (pivot !== i) [a[i], a[pivot]] = [a[pivot], a[i]];

      const div = a[i][i];
      for (let c = 0; c < 2 * n; c += 1) a[i][c] /= div;

      for (let r = 0; r < n; r += 1) {
        if (r === i) continue;
        const factor = a[r][i];
        for (let c = 0; c < 2 * n; c += 1) {
          a[r][c] -= factor * a[i][c];
        }
      }
    }

    return a.map((row) => row.slice(n));
  }

  function renderResult(data) {
    if (typeof data === "number") {
      el.result.textContent = Number(data.toFixed(8)).toString();
      return;
    }
    const table = document.createElement("table");
    table.className = "out-table";
    const tbody = document.createElement("tbody");

    data.forEach((row) => {
      const tr = document.createElement("tr");
      row.forEach((value) => {
        const td = document.createElement("td");
        td.textContent = Number(value.toFixed(8)).toString();
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    el.result.innerHTML = "";
    el.result.appendChild(table);
  }

  function applyDims() {
    dims = {
      a: { r: clampDim(el.rowsA.value), c: clampDim(el.colsA.value) },
      b: { r: clampDim(el.rowsB.value), c: clampDim(el.colsB.value) }
    };

    el.rowsA.value = String(dims.a.r);
    el.colsA.value = String(dims.a.c);
    el.rowsB.value = String(dims.b.r);
    el.colsB.value = String(dims.b.c);

    buildGrid(el.matrixA, dims.a.r, dims.a.c);
    buildGrid(el.matrixB, dims.b.r, dims.b.c);
    el.result.innerHTML = "";
    setStatus("Dimensions applied.", "neutral");
  }

  function compute() {
    try {
      const a = readMatrix(el.matrixA, dims.a.r, dims.a.c, "A");
      const b = readMatrix(el.matrixB, dims.b.r, dims.b.c, "B");
      const op = el.operation.value;

      let output;

      if (op === "add" || op === "subtract") {
        if (!sameDims(a, b)) throw new Error("Dimension mismatch for add/subtract");
        output = add(a, b, op === "add" ? 1 : -1);
      } else if (op === "multiply") {
        if (a[0].length !== b.length) throw new Error("Dimension mismatch for multiply");
        output = multiply(a, b);
      } else if (op === "transposeA") {
        output = transpose(a);
      } else if (op === "transposeB") {
        output = transpose(b);
      } else if (op === "detA") {
        output = determinant(a);
      } else if (op === "detB") {
        output = determinant(b);
      } else if (op === "invA") {
        output = inverse(a);
      } else if (op === "invB") {
        output = inverse(b);
      } else {
        throw new Error("Unsupported operation");
      }

      renderResult(output);
      setStatus("Computation successful.", "success");
    } catch (err) {
      el.result.innerHTML = "";
      setStatus(String(err.message || err), "error");
    }
  }

  el.resizeBtn.addEventListener("click", applyDims);
  el.computeBtn.addEventListener("click", compute);

  applyDims();
})();
