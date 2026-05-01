(() => {
  const KEY = "markdown-preview-content";
  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const statusEl = document.getElementById("status");
  const previewPanel = document.getElementById("previewPanel");
  const app = document.querySelector(".app");

  let statusTimeout = null;

  // ============================================
  // UTILITIES
  // ============================================

  function showStatus(message, type = "default") {
    clearTimeout(statusTimeout);
    statusEl.textContent = message;
    statusEl.className = `status-message show ${type}`;
    statusTimeout = setTimeout(() => {
      statusEl.classList.remove("show");
    }, 3000);
  }

  // ============================================
  // MARKDOWN RENDERING WITH MARKED & HIGHLIGHT.JS
  // ============================================

  function renderMarkdown(src) {
    if (!window.marked) {
      return "<p>Loading markdown parser...</p>";
    }

    // Configure marked for GitHub Flavored Markdown
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    try {
      let html = marked.parse(src || "");

      // Highlight code blocks
      if (window.hljs) {
        html = html.replace(/<pre><code class="language-([^"]*)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
          try {
            const highlighted = window.hljs.highlight(code, { language: lang || "plaintext", ignoreIllegals: true }).value;
            return `<pre><code class="hljs language-${lang}">${highlighted}</code></pre>`;
          } catch (e) {
            return match;
          }
        });
      }

      return html;
    } catch (err) {
      return `<p style="color: #f85149;">Error rendering markdown: ${err.message}</p>`;
    }
  }

  // ============================================
  // EDITOR UPDATE & PERSISTENCE
  // ============================================

  function updatePreview() {
    const src = editor.value;
    preview.innerHTML = renderMarkdown(src);
    localStorage.setItem(KEY, src);
  }

  // Debounce preview updates for performance
  let updateTimeout;
  editor.addEventListener("input", () => {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(updatePreview, 100);
  });

  // ============================================
  // FORMATTING TOOLBAR
  // ============================================

  function insertMarkdown(before, after = "") {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.substring(start, end);
    const newText = before + (selected || "text") + after;
    editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
    editor.focus();
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + (selected || "text").length;
    updatePreview();
  }

  function insertLine(markdown) {
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    editor.value = editor.value.substring(0, lineStart) + markdown + "\n" + editor.value.substring(lineStart);
    editor.focus();
    updatePreview();
  }

  // Toolbar button handlers
  document.getElementById("boldBtn").addEventListener("click", () => insertMarkdown("**", "**"));
  document.getElementById("italicBtn").addEventListener("click", () => insertMarkdown("*", "*"));
  document.getElementById("strikeBtn").addEventListener("click", () => insertMarkdown("~~", "~~"));

  document.getElementById("h1Btn").addEventListener("click", () => insertLine("# Heading 1"));
  document.getElementById("h2Btn").addEventListener("click", () => insertLine("## Heading 2"));
  document.getElementById("h3Btn").addEventListener("click", () => insertLine("### Heading 3"));

  document.getElementById("ulBtn").addEventListener("click", () => insertLine("- List item"));
  document.getElementById("olBtn").addEventListener("click", () => insertLine("1. List item"));

  document.getElementById("codeBtn").addEventListener("click", () => {
    insertLine("```\ncode block\n```");
  });

  document.getElementById("linkBtn").addEventListener("click", () => {
    const url = prompt("Enter URL:", "https://");
    if (url) insertMarkdown("[", `](${url})`);
  });

  document.getElementById("imageBtn").addEventListener("click", () => {
    const url = prompt("Enter image URL:", "https://");
    if (url) insertMarkdown("![alt text](", `)`);
  });

  // ============================================
  // ACTION BUTTONS
  // ============================================

  document.getElementById("clearBtn").addEventListener("click", () => {
    if (confirm("Clear all content? This cannot be undone.")) {
      editor.value = "";
      updatePreview();
      showStatus("Content cleared", "default");
    }
  });

  document.getElementById("copyBtn").addEventListener("click", async () => {
    const html = preview.innerHTML;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(html);
      } else {
        const ta = document.createElement("textarea");
        ta.value = html;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      showStatus("HTML copied to clipboard!", "success");
    } catch (err) {
      showStatus("Copy failed - try again", "error");
    }
  });

  document.getElementById("downloadBtn").addEventListener("click", () => {
    const content = editor.value;
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showStatus("Markdown downloaded!", "success");
  });

  // ============================================
  // FULLSCREEN PREVIEW
  // ============================================

  document.getElementById("fullscreenBtn").addEventListener("click", () => {
    app.classList.toggle("fullscreen-preview");
    const isFullscreen = app.classList.contains("fullscreen-preview");
    showStatus(isFullscreen ? "Fullscreen preview enabled (ESC to exit)" : "Fullscreen preview disabled", "default");
  });

  document.getElementById("closePreview").addEventListener("click", () => {
    app.classList.remove("fullscreen-preview");
    showStatus("Fullscreen preview closed", "default");
  });

  // ESC key to exit fullscreen
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && app.classList.contains("fullscreen-preview")) {
      app.classList.remove("fullscreen-preview");
      showStatus("Fullscreen preview closed", "default");
    }
  });

  // ============================================
  // MOBILE RESPONSIVE - SHOW/HIDE PREVIEW
  // ============================================

  if (window.innerWidth < 768) {
    previewPanel.classList.add("show");
    // On mobile, tapping preview button toggles preview visibility
    document.getElementById("fullscreenBtn").addEventListener("click", () => {
      previewPanel.classList.toggle("show");
    });
  }

  // ============================================
  // KEYBOARD SHORTCUTS
  // ============================================

  editor.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b") {
        e.preventDefault();
        insertMarkdown("**", "**");
      } else if (e.key === "i") {
        e.preventDefault();
        insertMarkdown("*", "*");
      }
    }
  });

  // ============================================
  // INITIALIZE
  // ============================================

  const savedContent = localStorage.getItem(KEY) || `# Welcome to Markdown Preview

Start typing markdown to see a live preview. All changes are automatically saved to your browser.

## Features
- **GitHub Flavored Markdown** - tables, task lists, strikethrough
- **Syntax highlighting** - for code blocks
- **Live preview** - updates as you type
- **Auto-save** - your work persists across sessions
- **Fullscreen mode** - focus on your writing

## Try it out!

### Code Example
\`\`\`javascript
function hello(name) {
  console.log(\`Hello, \${name}!\`);
}
\`\`\`

### Task List
- [x] Create project structure
- [x] Add markdown rendering
- [ ] Deploy to production

### Table Example
| Feature | Status |
|---------|--------|
| Editing | ✓ |
| Preview | ✓ |
| Export | ✓ |
`;

  editor.value = savedContent;
  updatePreview();
  showStatus("Ready to edit!", "success");
})();
