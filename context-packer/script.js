(function () {
  const inputText = document.getElementById("inputText");
  const outputText = document.getElementById("outputText");
  const trimWhitespace = document.getElementById("trimWhitespace");
  const collapseBlankLines = document.getElementById("collapseBlankLines");
  const removeDuplicateBlocks = document.getElementById("removeDuplicateBlocks");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  const copyBtn = document.getElementById("copyBtn");
  const statusEl = document.getElementById("status");

  const charsMetric = document.getElementById("charsMetric");
  const wordsMetric = document.getElementById("wordsMetric");
  const linesMetric = document.getElementById("linesMetric");
  const tokensMetric = document.getElementById("tokensMetric");

  function countMetrics(text) {
    const normalized = text.length > 0 ? text : "";
    const words = normalized.trim().length === 0 ? 0 : normalized.trim().split(/\s+/).length;
    const lines = normalized.length === 0 ? 0 : normalized.split(/\r?\n/).length;
    const chars = normalized.length;
    const tokens = Math.ceil(chars / 4);
    return { chars, words, lines, tokens };
  }

  function cleanWhitespace(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.replace(/[ \t]+/g, " ").trim())
      .join("\n");
  }

  function collapseBlanks(text) {
    return text.replace(/\n{3,}/g, "\n\n");
  }

  function removeExactDuplicateBlocks(text) {
    const blocks = text.split(/\n\s*\n/);
    const seen = new Set();
    const kept = [];
    blocks.forEach((block) => {
      const key = block.trim();
      if (!seen.has(key)) {
        seen.add(key);
        kept.push(block);
      }
    });
    return kept.join("\n\n");
  }

  function runCompaction() {
    const source = inputText.value;
    let result = source;

    if (trimWhitespace.checked) {
      result = cleanWhitespace(result);
    }
    if (collapseBlankLines.checked) {
      result = collapseBlanks(result);
    }
    if (removeDuplicateBlocks.checked) {
      result = removeExactDuplicateBlocks(result);
    }

    outputText.value = result;
    updateMetrics(source, result);
    statusEl.textContent = "Compaction complete.";
    statusEl.style.color = "#0d8f4a";
  }

  function updateMetrics(beforeText, afterText) {
    const before = countMetrics(beforeText);
    const after = countMetrics(afterText);
    charsMetric.textContent = `${before.chars} -> ${after.chars}`;
    wordsMetric.textContent = `${before.words} -> ${after.words}`;
    linesMetric.textContent = `${before.lines} -> ${after.lines}`;
    tokensMetric.textContent = `${before.tokens} -> ${after.tokens}`;
  }

  async function copyOutput() {
    const value = outputText.value;
    if (!value) {
      statusEl.textContent = "No output to copy.";
      statusEl.style.color = "#8f1d18";
      return;
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        outputText.focus();
        outputText.select();
        const ok = document.execCommand("copy");
        if (!ok) {
          throw new Error("copy failed");
        }
        window.getSelection().removeAllRanges();
      }
      statusEl.textContent = "Output copied.";
      statusEl.style.color = "#0d8f4a";
    } catch (error) {
      statusEl.textContent = "Copy failed. Use manual copy in this browser context.";
      statusEl.style.color = "#8f1d18";
    }
  }

  runBtn.addEventListener("click", runCompaction);
  copyBtn.addEventListener("click", copyOutput);

  resetBtn.addEventListener("click", () => {
    trimWhitespace.checked = true;
    collapseBlankLines.checked = true;
    removeDuplicateBlocks.checked = false;
    outputText.value = inputText.value;
    updateMetrics(inputText.value, outputText.value);
    statusEl.textContent = "Reset complete. Input remains the source of truth.";
    statusEl.style.color = "#0d8f4a";
  });

  inputText.addEventListener("input", () => {
    updateMetrics(inputText.value, outputText.value);
  });

  updateMetrics("", "");
})();
