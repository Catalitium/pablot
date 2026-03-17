(() => {
  const KEY = "markdown-preview-content";
  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const status = document.getElementById("status");

  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderMarkdown(src) {
    let text = escapeHtml(src || "");
    text = text.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>")
      .replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>")
      .replace(/^####\s+(.*)$/gm, "<h4>$1</h4>")
      .replace(/^###\s+(.*)$/gm, "<h3>$1</h3>")
      .replace(/^##\s+(.*)$/gm, "<h2>$1</h2>")
      .replace(/^#\s+(.*)$/gm, "<h1>$1</h1>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    text = text.replace(/(^|\n)-\s+(.*)(?=\n|$)/g, "$1<li>$2</li>");
    text = text.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");
    text = text.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>");
    return `<p>${text}</p>`;
  }

  function update() {
    const src = editor.value;
    preview.innerHTML = renderMarkdown(src);
    localStorage.setItem(KEY, src);
    status.textContent = "Preview updated.";
  }

  editor.addEventListener("input", update);

  document.getElementById("clearBtn").addEventListener("click", () => {
    editor.value = "";
    update();
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const html = preview.innerHTML;
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(html);
      else { const ta=document.createElement("textarea"); ta.value=html; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
      status.textContent = "Preview HTML copied.";
    } catch {
      status.textContent = "Copy failed in this browser context.";
    }
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "markdown-preview.md";
    a.click();
    URL.revokeObjectURL(url);
    status.textContent = "Markdown downloaded.";
  });

  editor.value = localStorage.getItem(KEY) || "# Markdown Preview\n\nType here.";
  update();
})();
