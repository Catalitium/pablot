(() => {
  const inputEl = document.getElementById("input");
  const rowsEl = document.getElementById("rows");
  const statusEl = document.getElementById("status");
  const formats = ["camel","pascal","snake","kebab","constant","title","dot"];

  function tokenize(value) {
    const trimmed = (value || "").trim();
    if (!trimmed) return [];
    return trimmed
      .replace(/([a-z\d])([A-Z])/g, "$1 $2")
      .replace(/[_\-.]+/g, " ")
      .replace(/\s+/g, " ")
      .split(" ")
      .filter(Boolean)
      .map((t) => t.toLowerCase());
  }

  function toCase(tokens, type) {
    if (!tokens.length) return "";
    if (type === "camel") return tokens[0] + tokens.slice(1).map((t)=>t[0].toUpperCase()+t.slice(1)).join("");
    if (type === "pascal") return tokens.map((t)=>t[0].toUpperCase()+t.slice(1)).join("");
    if (type === "snake") return tokens.join("_");
    if (type === "kebab") return tokens.join("-");
    if (type === "constant") return tokens.join("_").toUpperCase();
    if (type === "title") return tokens.map((t)=>t[0].toUpperCase()+t.slice(1)).join(" ");
    if (type === "dot") return tokens.join(".");
    return tokens.join(" ");
  }

  function render() {
    const tokens = tokenize(inputEl.value);
    rowsEl.innerHTML = "";
    formats.forEach((name) => {
      const v = toCase(tokens, name);
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<strong>${name}</strong><code>${v}</code><button data-copy="${v.replace(/"/g,"&quot;")}">Copy</button>`;
      rowsEl.appendChild(row);
    });
    statusEl.textContent = tokens.length ? `Tokens: ${tokens.length}` : "Enter text to convert.";
  }

  rowsEl.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-copy]");
    if (!btn) return;
    const text = btn.getAttribute("data-copy") || "";
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else { const t=document.createElement("textarea"); t.value=text; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
      statusEl.textContent = `Copied: ${text}`;
    } catch { statusEl.textContent = "Copy failed."; }
  });

  inputEl.addEventListener("input", render);
  render();
})();
