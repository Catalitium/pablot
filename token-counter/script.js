(() => {
  const models = {
    "gpt-4o-mini": { context: 128000, inCostPer1k: 0.00015 },
    "gpt-4.1": { context: 128000, inCostPer1k: 0.002 },
    "claude-sonnet": { context: 200000, inCostPer1k: 0.003 },
    "local-default": { context: 8192, inCostPer1k: 0 }
  };
  const modelEl = document.getElementById("model");
  const inputEl = document.getElementById("input");
  const charsEl = document.getElementById("chars");
  const wordsEl = document.getElementById("words");
  const linesEl = document.getElementById("lines");
  const tokensEl = document.getElementById("tokens");
  const usageEl = document.getElementById("usage");
  const costEl = document.getElementById("cost");
  const warningEl = document.getElementById("warning");

  Object.keys(models).forEach((k) => {
    const o = document.createElement("option");
    o.value = k;
    o.textContent = k;
    modelEl.appendChild(o);
  });

  function estimateTokens(text) {
    return Math.ceil(text.length / 4);
  }

  function recompute() {
    const text = inputEl.value || "";
    const model = models[modelEl.value] || models["local-default"];
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split(/\r?\n/).length : 0;
    const tokens = estimateTokens(text);
    const usage = model.context > 0 ? (tokens / model.context) * 100 : 0;
    const cost = (tokens / 1000) * model.inCostPer1k;

    charsEl.textContent = String(chars);
    wordsEl.textContent = String(words);
    linesEl.textContent = String(lines);
    tokensEl.textContent = String(tokens);
    usageEl.textContent = `${usage.toFixed(2)}%`;
    costEl.textContent = `$${cost.toFixed(4)}`;

    warningEl.className = "";
    if (usage >= 90) {
      warningEl.textContent = "Critical: context usage is above 90%.";
      warningEl.classList.add("danger");
    } else if (usage >= 70) {
      warningEl.textContent = "Warning: context usage is above 70%.";
      warningEl.classList.add("warn");
    } else {
      warningEl.textContent = "Within safe range.";
      warningEl.classList.add("ok");
    }
  }

  inputEl.addEventListener("input", recompute);
  modelEl.addEventListener("change", recompute);
  recompute();
})();
