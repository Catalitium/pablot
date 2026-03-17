(function () {
  const PALETTE_SIZE = 5;
  const FILENAME_BASE = "color-scheme-palette";
  const paletteGrid = document.getElementById("paletteGrid");
  const statusEl = document.getElementById("status");
  const regenerateBtn = document.getElementById("regenerateBtn");
  const copyCssBtn = document.getElementById("copyCssBtn");
  const copyJsonBtn = document.getElementById("copyJsonBtn");
  const downloadCssBtn = document.getElementById("downloadCssBtn");
  const downloadJsonBtn = document.getElementById("downloadJsonBtn");

  const state = {
    palette: [],
    locked: new Set()
  };

  function randomHex() {
    const bytes = new Uint8Array(3);
    if (window.crypto && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 3; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    return `#${Array.from(bytes).map((n) => n.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
  }

  function makeCssExport() {
    const lines = [":root {"];
    state.palette.forEach((hex, index) => {
      lines.push(`  --palette-color-${index + 1}: ${hex};`);
    });
    lines.push("}");
    return lines.join("\n");
  }

  function makeJsonExport() {
    const payload = {
      palette: state.palette.map((hex, index) => ({
        index,
        hex,
        locked: state.locked.has(index)
      }))
    };
    return JSON.stringify(payload, null, 2);
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.style.color = isError ? "#b42318" : "#117a37";
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const tmp = document.createElement("textarea");
    tmp.value = text;
    tmp.setAttribute("readonly", "readonly");
    tmp.style.position = "fixed";
    tmp.style.left = "-9999px";
    document.body.appendChild(tmp);
    tmp.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(tmp);
    if (!ok) {
      throw new Error("fallback copy failed");
    }
    return true;
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function regeneratePalette() {
    for (let i = 0; i < PALETTE_SIZE; i += 1) {
      if (!state.locked.has(i)) {
        state.palette[i] = randomHex();
      }
    }
    render();
  }

  function toggleLock(index) {
    if (state.locked.has(index)) {
      state.locked.delete(index);
    } else {
      state.locked.add(index);
    }
    render();
  }

  function render() {
    paletteGrid.innerHTML = "";
    state.palette.forEach((hex, index) => {
      const card = document.createElement("article");
      card.className = "card";
      card.innerHTML = `
        <div class="swatch" style="background:${hex}" aria-label="Color swatch ${hex}"></div>
        <div class="card-body">
          <p class="hex">${hex}</p>
          <div class="row">
            <button type="button" class="lock-btn ${state.locked.has(index) ? "is-locked" : ""}" data-index="${index}">
              ${state.locked.has(index) ? "Locked" : "Unlocked"}
            </button>
            <button type="button" class="copy-btn" data-hex="${hex}">Copy</button>
          </div>
        </div>
      `;
      paletteGrid.appendChild(card);
    });
  }

  paletteGrid.addEventListener("click", async (event) => {
    const lockBtn = event.target.closest(".lock-btn");
    const copyBtn = event.target.closest(".copy-btn");

    if (lockBtn) {
      const index = Number(lockBtn.dataset.index);
      toggleLock(index);
      setStatus(`Color ${index + 1} ${state.locked.has(index) ? "locked" : "unlocked"}.`, false);
      return;
    }

    if (copyBtn) {
      const hex = copyBtn.dataset.hex || "";
      try {
        await copyText(hex);
        setStatus(`Copied ${hex}.`, false);
      } catch (error) {
        setStatus("Copy failed. Select text manually if your browser blocks clipboard access.", true);
      }
    }
  });

  regenerateBtn.addEventListener("click", () => {
    const lockedCount = state.locked.size;
    regeneratePalette();
    if (lockedCount === PALETTE_SIZE) {
      setStatus("All colors are locked. Palette unchanged.", false);
      return;
    }
    setStatus("Generated new colors for unlocked slots.", false);
  });

  copyCssBtn.addEventListener("click", async () => {
    try {
      await copyText(makeCssExport());
      setStatus("Copied CSS variable export.", false);
    } catch (error) {
      setStatus("Could not copy CSS export in this context.", true);
    }
  });

  copyJsonBtn.addEventListener("click", async () => {
    try {
      await copyText(makeJsonExport());
      setStatus("Copied JSON export.", false);
    } catch (error) {
      setStatus("Could not copy JSON export in this context.", true);
    }
  });

  downloadCssBtn.addEventListener("click", () => {
    downloadText(`${FILENAME_BASE}.css`, makeCssExport());
    setStatus("Downloaded CSS export.", false);
  });

  downloadJsonBtn.addEventListener("click", () => {
    downloadText(`${FILENAME_BASE}.json`, makeJsonExport());
    setStatus("Downloaded JSON export.", false);
  });

  for (let i = 0; i < PALETTE_SIZE; i += 1) {
    state.palette.push(randomHex());
  }
  render();
})();
