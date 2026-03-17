(() => {
  const matrixInput = document.getElementById("matrixInput");
  const vectorInput = document.getElementById("vectorInput");
  const solveBtn = document.getElementById("solveBtn");
  const solveStatus = document.getElementById("solveStatus");
  const solveOutput = document.getElementById("solveOutput");
  const loadParityBtn = document.getElementById("loadParityBtn");
  const parityStatus = document.getElementById("parityStatus");
  const parityTable = document.getElementById("parityTable");
  const parityBody = document.querySelector("#parityTable tbody");

  const EPS = 1e-9;

  function parseMatrix(text) {
    const rows = text.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split(",").map((v) => Number(v.trim())));
    if (!rows.length) throw new Error("Matrix is empty.");
    const cols = rows[0].length;
    if (!cols) throw new Error("Matrix has no columns.");
    if (!rows.every((r) => r.length === cols && r.every((n) => Number.isFinite(n)))) {
      throw new Error("Matrix must be rectangular and numeric.");
    }
    return rows;
  }

  function parseVector(text) {
    const vec = text.split(",").map((v) => Number(v.trim()));
    if (!vec.length || vec.some((n) => !Number.isFinite(n))) throw new Error("Vector must be numeric.");
    return vec;
  }

  function solveGaussian(A, b) {
    const n = A.length;
    if (A[0].length !== n) throw new Error("Only square systems are supported.");
    if (b.length !== n) throw new Error("Dimension mismatch between A and b.");
    const M = A.map((row, i) => [...row, b[i]]);

    for (let col = 0; col < n; col += 1) {
      let pivot = col;
      for (let r = col + 1; r < n; r += 1) {
        if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
      }
      if (Math.abs(M[pivot][col]) < EPS) throw new Error("System is singular or near-singular.");
      if (pivot !== col) [M[pivot], M[col]] = [M[col], M[pivot]];

      for (let r = col + 1; r < n; r += 1) {
        const factor = M[r][col] / M[col][col];
        for (let c = col; c <= n; c += 1) M[r][c] -= factor * M[col][c];
      }
    }

    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i -= 1) {
      let sum = M[i][n];
      for (let j = i + 1; j < n; j += 1) sum -= M[i][j] * x[j];
      x[i] = sum / M[i][i];
    }
    return x;
  }

  solveBtn.addEventListener("click", () => {
    try {
      const A = parseMatrix(matrixInput.value);
      const b = parseVector(vectorInput.value);
      const solution = solveGaussian(A, b);
      solveStatus.textContent = "Solved in browser path.";
      solveOutput.textContent = JSON.stringify({ status: "pass", solution }, null, 2);
    } catch (err) {
      solveStatus.textContent = err.message;
      solveOutput.textContent = JSON.stringify({ status: "fail", error: err.message }, null, 2);
    }
  });

  function chip(status) {
    const safe = ["pass", "fail", "blocked"].includes(status) ? status : "blocked";
    return `<span class="chip ${safe}">${safe}</span>`;
  }

  loadParityBtn.addEventListener("click", async () => {
    parityBody.innerHTML = "";
    try {
      const res = await fetch("solver/output/parity-report.json", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load parity report. Run solver/run-parity.ps1 first.");
      const report = await res.json();
      const cases = Array.isArray(report.cases) ? report.cases : [];
      if (!cases.length) throw new Error("Parity report has no cases.");
      parityTable.hidden = false;
      cases.forEach((c) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${c.case_id}</td><td>${c.python_status}</td><td>${c.cpp_status}</td><td>${c.max_abs_diff}</td><td>${chip(c.parity_status)}</td>`;
        parityBody.appendChild(tr);
      });
      parityStatus.textContent = `Loaded parity report with ${cases.length} cases.`;
    } catch (err) {
      parityTable.hidden = true;
      parityStatus.textContent = err.message;
    }
  });
})();
