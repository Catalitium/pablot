    const TOOLS = [
      // Code
      {name:"Case Converter",slug:"case-converter",category:"code",icon:"Aa",desc:"Convert case formats"},
      {name:"Cron Builder",slug:"cron-builder",category:"code",icon:"🕐",desc:"Build cron expressions"},
      {name:"CSS Minifier",slug:"css-minifier",category:"code",icon:"🎀",desc:"Minify CSS"},
      {name:"CURL Builder",slug:"curl-builder",category:"code",icon:"🌐",desc:"Build CURL commands"},
      {name:"Data Converter",slug:"data-converter",category:"code",icon:"🔄",desc:"CSV/JSON/YAML"},
      {name:"Hash Generator",slug:"hash-generator",category:"code",icon:"#️⃣",desc:"MD5/SHA hashes"},
      {name:"JSON Formatter",slug:"json-formatter",category:"code",icon:"{ }",desc:"Format JSON"},
      {name:"Markdown Preview",slug:"markdown-preview",category:"code",icon:"📑",desc:"Live markdown preview"},
      {name:"JSON Schema Gen",slug:"json-schema-generator",category:"code",icon:"📋",desc:"Generate JSON schemas"},
      {name:"JWT Decoder",slug:"jwt-decoder",category:"code",icon:"🔐",desc:"Decode JWT tokens"},
      {name:"Regex Tester",slug:"regex-tester",category:"code",icon:".*",desc:"Test regex patterns"},
      {name:"SQL Builder",slug:"sql-builder",category:"code",icon:"🗃️",desc:"Build SQL queries"},
      {name:"URL Parser",slug:"url-parser",category:"code",icon:"🔗",desc:"Parse URLs"},
      {name:"UUID Generator",slug:"uuid-generator",category:"code",icon:"🆔",desc:"Generate UUIDs"},
      {name:"YAML Formatter",slug:"yaml-formatter",category:"code",icon:"📄",desc:"Format YAML"},

      // Design
      {name:"Color Scheme",slug:"color-scheme",category:"design",icon:"🌈",desc:"Generate palettes"},
      {name:"Gradient Generator",slug:"gradient-generator",category:"design",icon:"🌅",desc:"CSS gradients"},
      {name:"Hex Palette",slug:"hex-palette",category:"design",icon:"🖌️",desc:"Color palette"},
      {name:"Social Card",slug:"social-card",category:"design",icon:"📱",desc:"Design social cards"},
      {name:"Generative Art",slug:"generative-art",category:"design",icon:"✨",desc:"Mathematical art generation"},
      {name:"Audio Visualizer",slug:"audio-visualizer",category:"design",icon:"🎵",desc:"Realtime audio FFT"},

      // Data
      {name:"Base64",slug:"base64",category:"data",icon:"🔤",desc:"Encode/decode Base64"},
      {name:"Binary Converter",slug:"binary-converter",category:"data",icon:"0️⃣",desc:"Binary/hex converter"},

      // Math
      {name:"Complex Plane",slug:"complex-plane",category:"math",icon:"📊",desc:"Julia sets visualization"},
      {name:"Fourier Visualizer",slug:"fourier-visualizer",category:"math",icon:"〰️",desc:"FFT decomposition"},
      {name:"Graphing Calculator",slug:"graphing-calculator",category:"math",icon:"📈",desc:"Plot functions"},
      {name:"Linear Solver",slug:"linear-solver",category:"math",icon:"➗",desc:"Solve linear equations"},
      {name:"Matrix Calculator",slug:"matrix-calculator",category:"math",icon:"🔢",desc:"Matrix operations"},

      // AI
      {name:"Token Counter",slug:"token-counter",category:"ai",icon:"🔢",desc:"Count tokens"},
      {name:"Context Packer",slug:"context-packer",category:"ai",icon:"📦",desc:"Pack context for LLMs"},

      // Tools
      {name:"Aspect Ratio",slug:"aspect-ratio",category:"tools",icon:"📐",desc:"Image dimension calculator"},
      {name:"Countdown Timer",slug:"countdown-timer",category:"tools",icon:"⏱",desc:"Countdown to date"},
      {name:"DNA Helix",slug:"dna-helix",category:"tools",icon:"🔬",desc:"3D DNA visualization"},
      {name:"Timezone Converter",slug:"timezone-converter",category:"tools",icon:"🌍",desc:"Time zones"},
      {name:"Word Counter",slug:"word-counter",category:"tools",icon:"📊",desc:"Count words"},
      {name:"CV Builder",slug:"cv-builder",category:"tools",icon:"📋",desc:"Upload, clean, export PDF"},
    ];

    const CATEGORIES = {
      code:{name:"Code",icon:"💻"},
      design:{name:"Design",icon:"🎨"},
      data:{name:"Data",icon:"📊"},
      math:{name:"Math",icon:"📐"},
      ai:{name:"AI",icon:"🤖"},
      tools:{name:"Tools",icon:"⚙️"}
    };

    let activeCategory = "all";

    const RECENT_KEY = "pablobot_recent_tools_v1";
    const MAX_RECENT = 5;

    const tabsEl      = document.getElementById("tabs");
    const toolsGridEl = document.getElementById("toolsGrid");
    const searchInput = document.getElementById("searchInput");
    const searchClear = document.getElementById("searchClear");
    const toolCount   = document.getElementById("toolCount");
    const headerEl    = document.querySelector(".header");

    function escapeHtml(str) {
      return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }

    function readRecent() {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr : [];
      } catch (_) { return []; }
    }

    function writeRecent(items) {
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT))); } catch (_) {}
    }

    function recordRecent(slug, name) {
      if (!slug) return;
      const next = readRecent().filter(x => x.slug !== slug);
      next.unshift({ slug, name: name || slug, t: Date.now() });
      writeRecent(next);
      renderRecentStrip();
    }

    function renderRecentStrip() {
      const strip = document.getElementById("recentStrip");
      const chips = document.getElementById("recentChips");
      if (!strip || !chips) return;
      const items = readRecent();
      if (!items.length) { strip.hidden = true; return; }
      strip.hidden = false;
      chips.innerHTML = items.map(x =>
        `<a href="${escapeHtml(x.slug)}/" class="recent-chip">${escapeHtml(x.name)}</a>`
      ).join("");
    }

    function applyUrlToState() {
      const params = new URLSearchParams(window.location.search);
      const cat = params.get("cat");
      const q = params.get("q");
      if (cat === "all" || (cat && CATEGORIES[cat])) activeCategory = cat;
      if (typeof q === "string" && searchInput) searchInput.value = q;
    }

    function syncAddressBar() {
      const params = new URLSearchParams();
      if (activeCategory !== "all") params.set("cat", activeCategory);
      const q = searchInput ? searchInput.value.trim() : "";
      if (q) params.set("q", q);
      const qs = params.toString();
      const path = window.location.pathname || "/";
      const next = qs ? `${path}?${qs}` : path;
      const cur = path + (window.location.search || "");
      if (next !== cur) history.replaceState(null, "", next);
    }

    function init() {
      applyUrlToState();
      const heroStats = document.getElementById("heroStats");
      if (heroStats) heroStats.textContent = `${TOOLS.length} curated tools · static · no signup · ${WIP_TOOLS.length} more in the lab`;
      renderTabs();
      renderTools(searchInput ? searchInput.value : "");
      renderRecentStrip();
      initPageBehaviours();
    }

    function renderTabs() {
      let html = `<button class="tab ${activeCategory === "all" ? "active" : ""}" data-cat="all">All</button>`;
      for (const [key, val] of Object.entries(CATEGORIES)) {
        const count = TOOLS.filter(t => t.category === key).length;
        if (count < 2) continue;
        html += `<button class="tab ${activeCategory === key ? "active" : ""}" data-cat="${key}">${val.name} (${count})</button>`;
      }
      tabsEl.innerHTML = html;
    }

    function renderTools(filter = "") {
      const q = filter.toLowerCase().trim();
      let filtered = activeCategory === "all" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);
      if (q) filtered = filtered.filter(t => t.name.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));

      // Update count badge
      toolCount.textContent = filtered.length + (filtered.length === 1 ? " tool" : " tools");

      // Show/hide clear button & shortcut hint
      searchClear.hidden = !q;

      if (!filtered.length) {
        toolsGridEl.innerHTML = `
          <div class="tools-empty">
            <div class="tools-empty-icon">🔍</div>
            <p>No tools match "<strong>${escapeHtml(q)}</strong>"</p>
            <button type="button" class="tools-empty-clear">Clear search</button>
          </div>`;
        syncAddressBar();
        return;
      }

      toolsGridEl.innerHTML = filtered.map(tool => `
        <a href="${escapeHtml(tool.slug)}/" class="tool-card" target="_blank" rel="noopener noreferrer" data-tool-slug="${escapeHtml(tool.slug)}">
          <div class="tool-icon">${tool.icon}</div>
          <div class="tool-name">${escapeHtml(tool.name)}</div>
          <div class="tool-desc">${escapeHtml(tool.desc)}</div>
        </a>`).join("");
      syncAddressBar();
    }

    function clearSearch() {
      searchInput.value = "";
      searchClear.hidden = true;
      renderTools("");
      searchInput.focus();
    }

    function initPageBehaviours() {
      const heroBrowse = document.getElementById("heroBrowseBtn");
      if (heroBrowse) {
        heroBrowse.addEventListener("click", () => {
          document.getElementById("toolsSection").scrollIntoView({ behavior: "smooth", block: "start" });
          searchInput.focus();
        });
      }

      toolsGridEl.addEventListener("click", e => {
        if (e.target.closest(".tools-empty-clear")) {
          e.preventDefault();
          clearSearch();
          return;
        }
        const card = e.target.closest("a.tool-card");
        if (!card) return;
        const slug = card.dataset.toolSlug;
        const nameEl = card.querySelector(".tool-name");
        recordRecent(slug, nameEl ? nameEl.textContent.trim() : slug);
      });

      // Sticky header — blur on scroll
      window.addEventListener("scroll", () => {
        headerEl.classList.toggle("scrolled", window.scrollY > 10);
      }, { passive: true });

      // "/" shortcut focuses search
      document.addEventListener("keydown", e => {
        if (e.key === "/" && document.activeElement !== searchInput &&
            !["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
        // Escape clears/blurs search
        if (e.key === "Escape" && document.activeElement === searchInput) {
          if (searchInput.value) { clearSearch(); }
          else { searchInput.blur(); }
        }
      });

      // Search input wiring
      searchInput.addEventListener("input", e => renderTools(e.target.value));
      searchClear.addEventListener("click", clearSearch);

      // Tab click — re-render + scroll grid into view
      tabsEl.addEventListener("click", e => {
        const tab = e.target.closest(".tab");
        if (!tab) return;
        document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
        tab.classList.add("active");
        activeCategory = tab.dataset.cat;
        renderTools(searchInput.value);
        document.getElementById("toolsSection").scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const WIP_TOOLS = [
      // No index.html — moved from live tools
      { name:"API Tester",          slug:"api-tester",         icon:"🧪", desc:"Test and debug API endpoints",           type:"Web" },
      { name:"ASCII Art",           slug:"ascii-art",           icon:"🎨", desc:"Generate ASCII art from text",           type:"Web" },
      { name:"Auto-Prompter",       slug:"auto-prompter",       icon:"🤖", desc:"Prompt chaining and automation",         type:"Web" },
      { name:"Markdown Preview",    slug:"markdown-preview",    icon:"📑", desc:"Live markdown editor and preview",        type:"Web" },
      { name:"Prompt Tester",       slug:"prompt-tester",       icon:"💬", desc:"Test and compare AI prompts",            type:"Web" },
      { name:"Text Summarizer",     slug:"text-summarizer",     icon:"📝", desc:"Summarize text with AI",                 type:"Web" },
      // No index.html — never listed
      { name:"Audio Visualizer",    slug:"audio-visualizer",    icon:"🎵", desc:"Real-time audio visualization",          type:"Web" },
      { name:"Cache Cleaner",       slug:"cache-cleaner",       icon:"🧹", desc:"Browser cache management tool",          type:"Web" },
      { name:"Conway's Game",       slug:"conway-game",         icon:"🧬", desc:"Cellular automaton simulator",           type:"Web" },
      { name:"Fake Data Gen",       slug:"fake-data-gen",       icon:"🎭", desc:"Generate realistic test data",           type:"Web" },
      { name:"Git Helper",          slug:"git-helper",          icon:"🌿", desc:"Git commands and workflow assistant",     type:"Web" },
      { name:"LLM Cost Tracker",    slug:"llm-cost-tracker",    icon:"💰", desc:"Track and estimate AI API spending",     type:"Web" },
      { name:"Lorenz Attractor",    slug:"lorenz-attractor",    icon:"🌀", desc:"Chaos theory 3D visualizer",             type:"Web" },
      { name:"Maze Master",         slug:"maze-master",         icon:"🧩", desc:"Maze generation and pathfinding",        type:"Web" },
      { name:"MD to HTML",          slug:"md2html",             icon:"📄", desc:"Markdown to HTML converter",             type:"Web" },
      { name:"Mini Agents",         slug:"mini-agents",         icon:"🤖", desc:"Lightweight AI agent runner",            type:"Web" },
      { name:"QR Generator",        slug:"qr-generator",        icon:"📱", desc:"Generate and style QR codes",            type:"Web" },
      { name:"Secure Vault",        slug:"secure-vault",        icon:"🔒", desc:"Encrypted local password vault",         type:"Web" },
      { name:"SEO Intel",           slug:"seo-intel",           icon:"🔍", desc:"SEO analysis and keyword insights",      type:"Web" },
      { name:"System Health",       slug:"system-health",       icon:"💚", desc:"Monitor system performance metrics",     type:"Web" },
      { name:"Typing Test",         slug:"typing-test",         icon:"⌨️", desc:"WPM speed and accuracy test",           type:"Web" },
      // No web UI — scripts only
      { name:"Backup Mirror",       slug:"backup-mirror",       icon:"🪞", desc:"Sync and mirror file backups",           type:"PowerShell" },
      { name:"CPU Benchmark",       slug:"cpu-benchmark",       icon:"⚡", desc:"Measure and compare CPU performance",    type:"PowerShell" },
      { name:"Disk Space Health",   slug:"disk-space-health",   icon:"💾", desc:"Visualise and monitor disk usage",       type:"PowerShell" },
      { name:"Git Worktree",        slug:"git-worktree",        icon:"🌿", desc:"Manage multiple git worktrees",          type:"Shell" },
      { name:"RSA Key Generator",   slug:"rsa-keygen",          icon:"🔑", desc:"Generate RSA key pairs locally",         type:"Rust" },
    ];

    function renderWipTools() {
      const grid = document.getElementById("wipGrid");
      const typeClass = { Web:"web", PowerShell:"powershell", Shell:"shell", Rust:"rust" };
      grid.innerHTML = WIP_TOOLS.map(t => `
        <div class="wip-card" title="${t.name} — coming soon">
          <span class="wip-card-badge">WIP</span>
          <div class="wip-card-icon">${t.icon}</div>
          <div class="wip-card-name">${t.name}</div>
          <span class="wip-card-type wip-card-type--${typeClass[t.type] || "web"}">${t.type}</span>
          <div class="wip-card-bar"><div class="wip-card-bar-fill"></div></div>
        </div>`).join("");
    }

    init();
    renderWipTools();

    /* ============================================================
       AI MODELS GALLERY — DATA
    ============================================================ */

    const FAMILY_COLORS = {
      "Arcee":   "#a855f7",
      "DeepSeek":"#0ea5e9",
      "Google":  "#f59e0b",
      "GLM":     "#8b5cf6",
      "OpenAI":  "#10b981",
      "xAI":     "#64748b",
      "Moonshot":"#06b6d4",
      "Meta":    "#3b82f6",
      "MiniMax": "#ec4899",
      "Mistral": "#f97316",
      "Nvidia":  "#22c55e",
      "AllenAI": "#84cc16",
      "Qwen":    "#ef4444",
      "Others":  "#94a3b8"
    };

    const GROUP_COLORS = {
      "MoE":   "#f97316",
      "MLA":   "#8b5cf6",
      "GQA":   "#0ea5e9",
      "SWA":   "#10b981",
      "Sparse":"#ef4444",
      "Gated": "#ec4899",
      "Other": "#94a3b8"
    };

    const AI_MODELS = [
      { name:"Trinity Large 400B",         params:400,  paramsLabel:"400B",        sizeBucket:"large",  family:"Arcee",    filename:"arcee-ai-trinity-large-400b" },
      { name:"DeepSeek V3.2 671B",         params:671,  paramsLabel:"671B",        sizeBucket:"xlarge", family:"DeepSeek", filename:"deepseek-v3-2-671b" },
      { name:"DeepSeek R1 671B",           params:671,  paramsLabel:"671B",        sizeBucket:"xlarge", family:"DeepSeek", filename:"deepseek-v3-r1-671-billion" },
      { name:"Gemma 3 27B",                params:27,   paramsLabel:"27B",         sizeBucket:"medium", family:"Google",   filename:"gemma-3-27b" },
      { name:"GLM 4.5 355B",               params:355,  paramsLabel:"355B",        sizeBucket:"large",  family:"GLM",      filename:"glm-4-5-355b" },
      { name:"GLM 4.7 355B",               params:355,  paramsLabel:"355B",        sizeBucket:"large",  family:"GLM",      filename:"glm-4-7-355b" },
      { name:"GLM 5 744B",                 params:744,  paramsLabel:"744B",        sizeBucket:"xlarge", family:"GLM",      filename:"glm-5-744b" },
      { name:"GPT OSS 120B",               params:120,  paramsLabel:"120B",        sizeBucket:"large",  family:"OpenAI",   filename:"gpt-oss-120b" },
      { name:"GPT OSS 20B",                params:20,   paramsLabel:"20B",         sizeBucket:"medium", family:"OpenAI",   filename:"gpt-oss-20b" },
      { name:"Grok 2.5 270B",              params:270,  paramsLabel:"270B",        sizeBucket:"large",  family:"xAI",      filename:"grok-2-5-270b" },
      { name:"Kimi K2 1T",                 params:1000, paramsLabel:"1T",          sizeBucket:"xlarge", family:"Moonshot", filename:"kimi-k2-1-trillion" },
      { name:"Kimi Linear 48B A3B",        params:48,   paramsLabel:"48B (A3B)",   sizeBucket:"medium", family:"Moonshot", filename:"kimi-linear-48b-a3b" },
      { name:"Ling 2.5 1T",                params:1000, paramsLabel:"1T",          sizeBucket:"xlarge", family:"Others",   filename:"ling-2-5-1t" },
      { name:"Llama 3 8B",                 params:8,    paramsLabel:"8B",          sizeBucket:"small",  family:"Meta",     filename:"llama-3-8b" },
      { name:"Llama 4 Maverick 400B",      params:400,  paramsLabel:"400B",        sizeBucket:"large",  family:"Meta",     filename:"llama-4-maverick-400b" },
      { name:"MiniMax M2 230B",            params:230,  paramsLabel:"230B",        sizeBucket:"large",  family:"MiniMax",  filename:"minimax-m2-230b" },
      { name:"MiniMax M2.5 230B",          params:230,  paramsLabel:"230B",        sizeBucket:"large",  family:"MiniMax",  filename:"minimax-m2-5-230b" },
      { name:"Mistral 3.1 Small 24B",      params:24,   paramsLabel:"24B",         sizeBucket:"medium", family:"Mistral",  filename:"mistral-3-1-small-24b" },
      { name:"Mistral 3 Large 673B",       params:673,  paramsLabel:"673B",        sizeBucket:"xlarge", family:"Mistral",  filename:"mistral-3-large-673-billion" },
      { name:"Nanbeige 4.1 3B",            params:3,    paramsLabel:"3B",          sizeBucket:"small",  family:"Others",   filename:"nanbeige-4-1-3b" },
      { name:"Nemotron 3 Nano 30B A3B",    params:30,   paramsLabel:"30B (A3B)",   sizeBucket:"medium", family:"Nvidia",   filename:"nemotron-3-nano-30b-a3b" },
      { name:"Nemotron 3 Super 120B A12B", params:120,  paramsLabel:"120B (A12B)", sizeBucket:"large",  family:"Nvidia",   filename:"nemotron-3-super-120b-a12b" },
      { name:"OLMo 2 7B",                  params:7,    paramsLabel:"7B",          sizeBucket:"small",  family:"AllenAI",  filename:"olmo-2-7b" },
      { name:"OLMo 3 32B",                 params:32,   paramsLabel:"32B",         sizeBucket:"medium", family:"AllenAI",  filename:"olmo-3-32b" },
      { name:"OLMo 3 7B",                  params:7,    paramsLabel:"7B",          sizeBucket:"small",  family:"AllenAI",  filename:"olmo-3-7b" },
      { name:"Qwen3 235B A22B",            params:235,  paramsLabel:"235B (A22B)", sizeBucket:"large",  family:"Qwen",     filename:"qwen3-235b-a22b" },
      { name:"Qwen3 32B",                  params:32,   paramsLabel:"32B",         sizeBucket:"medium", family:"Qwen",     filename:"qwen3-32b" },
      { name:"Qwen3 4B",                   params:4,    paramsLabel:"4B",          sizeBucket:"small",  family:"Qwen",     filename:"qwen3-4b" },
      { name:"Qwen3.5 397B",               params:397,  paramsLabel:"397B",        sizeBucket:"large",  family:"Qwen",     filename:"qwen3-5-397b" },
      { name:"Qwen3 8B",                   params:8,    paramsLabel:"8B",          sizeBucket:"small",  family:"Qwen",     filename:"qwen3-8b" },
      { name:"Qwen3 Next 80B A3B",         params:80,   paramsLabel:"80B (A3B)",   sizeBucket:"medium", family:"Qwen",     filename:"qwen3-next-80b-a3b" },
      { name:"Sarvam 105B",                params:105,  paramsLabel:"105B",        sizeBucket:"large",  family:"Others",   filename:"sarvam-105b" },
      { name:"Sarvam 30B",                 params:30,   paramsLabel:"30B",         sizeBucket:"medium", family:"Others",   filename:"sarvam-30b" },
      { name:"SmolLM3 3B",                 params:3,    paramsLabel:"3B",          sizeBucket:"small",  family:"Others",   filename:"smollm3-3b" },
      { name:"Step 3.5 Flash 196B",        params:196,  paramsLabel:"196B",        sizeBucket:"large",  family:"Others",   filename:"step-3-5-flash-196b" },
      { name:"Tiny Aya 3 35B",             params:35,   paramsLabel:"35B",         sizeBucket:"medium", family:"Others",   filename:"tiny-aya-3-35b" },
      { name:"Xiaomi MiMo V2 Flash 309B",  params:309,  paramsLabel:"309B",        sizeBucket:"large",  family:"Others",   filename:"xiaomi-mimo-v2-flash-309b" }
    ];

    const AI_CONCEPTS = [
      { name:"MoE: Active vs Total Parameters",    group:"MoE",    filename:"moe-active-vs-total",                      ext:"png" },
      { name:"MoE: DeepSeek V3 vs FFN",            group:"MoE",    filename:"moe-deepseek-v3-vs-ffn",                   ext:"png" },
      { name:"Latent MoE: Nemotron Super",          group:"MoE",    filename:"latent-moe-nemotron-super",                ext:"png" },
      { name:"MLA: DeepSeek V2 Ablation",          group:"MLA",    filename:"mla-deepseek-v2-ablation",                 ext:"png" },
      { name:"MLA: Memory Savings",                group:"MLA",    filename:"mla-memory-savings",                       ext:"png" },
      { name:"MLA vs MHA Comparison",              group:"MLA",    filename:"mla-vs-mha",                               ext:"webp" },
      { name:"GQA: Memory Savings",                group:"GQA",    filename:"gqa-memory-savings",                       ext:"png" },
      { name:"GQA: MHA vs GQA",                    group:"GQA",    filename:"gqa-mha-vs-gqa",                           ext:"webp" },
      { name:"GQA vs MLA Relative Efficiency",     group:"GQA",    filename:"gqa-vs-mla-relative-efficiency",           ext:"png" },
      { name:"SWA: Gemma Ablation Study",          group:"SWA",    filename:"swa-gemma-ablation",                       ext:"webp" },
      { name:"SWA: Global vs Local Attention",     group:"SWA",    filename:"swa-global-vs-local",                      ext:"webp" },
      { name:"SWA: Memory Savings",                group:"SWA",    filename:"swa-memory-savings",                       ext:"png" },
      { name:"Sparse Attention: DeepSeek V3.2",    group:"Sparse", filename:"deepseek-sparse-attention-deepseek-v3-2",  ext:"webp" },
      { name:"Sparse Attention: Flow Diagram",     group:"Sparse", filename:"deepseek-sparse-attention-flow",           ext:"png" },
      { name:"Sparse Attention: GLM5 vs GLM4.5",  group:"Sparse", filename:"deepseek-sparse-attention-glm5-vs-glm45",  ext:"webp" },
      { name:"Sparse Attention: Sliding Window",   group:"Sparse", filename:"deepseek-sparse-attention-sliding-window", ext:"png" },
      { name:"Gated Attention: Qwen3 Next",        group:"Gated",  filename:"gated-attention-qwen3-next",               ext:"webp" },
      { name:"Gated Attention: Trinity Mechanism", group:"Gated",  filename:"gated-attention-trinity-mechanism",        ext:"png" },
      { name:"Gated DeltaNet: Hybrid Overview",    group:"Gated",  filename:"gated-deltanet-hybrid-overview",           ext:"webp" },
      { name:"Gated DeltaNet: Memory Savings",     group:"Gated",  filename:"gated-deltanet-memory-savings",            ext:"png" },
      { name:"Gated DeltaNet: Qwen3.5",            group:"Gated",  filename:"gated-deltanet-qwen35",                    ext:"png" },
      { name:"NoPE: Length Generalization",        group:"Other",  filename:"nope-length-generalization",               ext:"webp" },
      { name:"NoPE: SmolLM3 3B",                   group:"Other",  filename:"nope-smollm3-3b",                          ext:"webp" },
      { name:"QK-Norm: Training Stability",        group:"Other",  filename:"qk-norm-training-stability",               ext:"webp" }
    ];

    /* ============================================================
       AI MODELS GALLERY — STATE & DOM REFS
    ============================================================ */

    let galleryActiveFamily = "all";
    let galleryActiveSize   = "all";
    let conceptActiveGroup  = "all";
    let lightboxItems       = [];
    let lightboxIndex       = 0;
    let _savedScrollY       = 0;

    const galleryEl      = document.getElementById("aiGallery");
    const galleryContent = document.getElementById("galleryContent");
    const modelsGrid     = document.getElementById("modelsGrid");
    const conceptsGrid   = document.getElementById("conceptsGrid");
    const lightboxEl     = document.getElementById("lightbox");
    const lightboxImg    = document.getElementById("lightboxImg");
    const lightboxTitle  = document.getElementById("lightboxTitle");
    const lightboxMeta   = document.getElementById("lightboxMeta");

    /* ============================================================
       GALLERY OPEN / CLOSE
    ============================================================ */

    function openGallery() {
      _savedScrollY = window.scrollY;
      galleryEl.classList.add("gallery-open");
      galleryEl.setAttribute("aria-hidden", "false");
      document.getElementById("aiModelsBtn").setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      galleryContent.scrollTop = 0;
      if (!galleryEl.dataset.rendered) {
        buildFamilyFilters();
        renderModels();
        renderConcepts();
        galleryEl.dataset.rendered = "true";
      }
      galleryEl.focus();
    }

    function closeGallery() {
      galleryEl.classList.remove("gallery-open");
      galleryEl.setAttribute("aria-hidden", "true");
      document.getElementById("aiModelsBtn").setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      window.scrollTo(0, _savedScrollY);
      document.getElementById("aiModelsBtn").focus();
    }

    /* ============================================================
       FILTER CHIP HELPER
    ============================================================ */

    function updateFilterChips(containerId, dataAttr, activeValue) {
      document.getElementById(containerId).querySelectorAll(".filter-chip").forEach(chip => {
        const isActive = chip.dataset[dataAttr] === activeValue;
        chip.classList.toggle("active", isActive);
        chip.setAttribute("aria-checked", isActive ? "true" : "false");
      });
    }

    /* ============================================================
       FAMILY FILTER — built dynamically from data
    ============================================================ */

    function buildFamilyFilters() {
      const families = ["all", ...Array.from(new Set(AI_MODELS.map(m => m.family))).sort()];
      document.getElementById("familyFilters").innerHTML = families.map(f => {
        const label = f === "all" ? "All families" : f;
        return `<button class="filter-chip${f === "all" ? " active" : ""}" data-family="${f}" role="radio" aria-checked="${f === "all" ? "true" : "false"}">${label}</button>`;
      }).join("");
    }

    /* ============================================================
       RENDER MODELS
    ============================================================ */

    function getSizeBadge(bucket) {
      return { small:"Small", medium:"Mid-size", large:"Large", xlarge:"Frontier" }[bucket] || bucket;
    }

    function renderModels() {
      const list = AI_MODELS.filter(m => {
        const fm = galleryActiveFamily === "all" || m.family === galleryActiveFamily;
        const sm = galleryActiveSize   === "all" || m.sizeBucket === galleryActiveSize;
        return fm && sm;
      });

      if (!list.length) {
        modelsGrid.innerHTML = `<p class="gallery-empty">No models match the selected filters.</p>`;
        return;
      }

      modelsGrid.innerHTML = list.map((m, i) => {
        const fc = FAMILY_COLORS[m.family] || "#2563eb";
        return `
        <article class="gallery-card" role="listitem" tabindex="0"
                 style="--fc:${fc}"
                 data-lightbox-index="${i}" data-lightbox-set="models"
                 aria-label="${m.name}, ${m.paramsLabel} parameters, ${m.family}">
          <div class="gallery-card-img-wrap">
            <img class="gallery-card-img"
                 src="assets/architectures/${m.filename}.webp"
                 alt="${m.name} architecture diagram — ${m.paramsLabel}, ${m.family}"
                 loading="lazy" decoding="async" width="320" height="240">
            <div class="gallery-card-img-overlay">
              <span class="gallery-card-expand">⤢ Expand</span>
            </div>
            <span class="gallery-card-params-badge">${m.paramsLabel}</span>
          </div>
          <div class="gallery-card-body">
            <div class="gallery-card-meta">
              <span class="gallery-card-dot"></span>
              <span class="gallery-card-family">${m.family}</span>
            </div>
            <p class="gallery-card-name">${m.name}</p>
            <span class="gallery-card-size-badge">${getSizeBadge(m.sizeBucket)}</span>
          </div>
        </article>`;
      }).join("");
    }

    /* ============================================================
       RENDER CONCEPTS
    ============================================================ */

    function renderConcepts() {
      const list = conceptActiveGroup === "all"
        ? AI_CONCEPTS
        : AI_CONCEPTS.filter(c => c.group === conceptActiveGroup);

      if (!list.length) {
        conceptsGrid.innerHTML = `<p class="gallery-empty">No concepts in this group.</p>`;
        return;
      }

      conceptsGrid.innerHTML = list.map((c, i) => {
        const fc = GROUP_COLORS[c.group] || "#2563eb";
        return `
        <article class="gallery-card" role="listitem" tabindex="0"
                 style="--fc:${fc}"
                 data-lightbox-index="${i}" data-lightbox-set="concepts"
                 aria-label="${c.name}, ${c.group} technique">
          <div class="gallery-card-img-wrap">
            <img class="gallery-card-img"
                 src="assets/concepts/${c.filename}.${c.ext}"
                 alt="${c.name} — ${c.group} technique visualization"
                 loading="lazy" decoding="async" width="400" height="300">
            <div class="gallery-card-img-overlay">
              <span class="gallery-card-expand">⤢ Expand</span>
            </div>
            <span class="gallery-card-params-badge">${c.group}</span>
          </div>
          <div class="gallery-card-body">
            <div class="gallery-card-meta">
              <span class="gallery-card-dot"></span>
              <span class="gallery-card-family">${c.group}</span>
            </div>
            <p class="gallery-card-name">${c.name}</p>
          </div>
        </article>`;
      }).join("");
    }

    /* ============================================================
       LIGHTBOX
    ============================================================ */

    function getFilteredModels() {
      return AI_MODELS.filter(m => {
        const fm = galleryActiveFamily === "all" || m.family === galleryActiveFamily;
        const sm = galleryActiveSize   === "all" || m.sizeBucket === galleryActiveSize;
        return fm && sm;
      });
    }

    function getFilteredConcepts() {
      return conceptActiveGroup === "all" ? AI_CONCEPTS : AI_CONCEPTS.filter(c => c.group === conceptActiveGroup);
    }

    function openLightbox(setOrItems, index) {
      let items;
      if (Array.isArray(setOrItems)) {
        items = setOrItems;
      } else if (setOrItems === "models") {
        items = getFilteredModels().map(m => ({ src:`assets/architectures/${m.filename}.webp`, title:m.name, meta:`${m.family} · ${m.paramsLabel} parameters` }));
      } else {
        items = getFilteredConcepts().map(c => ({ src:`assets/concepts/${c.filename}.${c.ext}`,  title:c.name,  meta:c.group }));
      }

      lightboxItems = items;
      lightboxIndex = index;
      showLightboxFrame();
      lightboxEl.classList.add("lightbox-open");
      lightboxEl.setAttribute("aria-hidden", "false");
      document.getElementById("lightboxClose").focus();
    }

    function showLightboxFrame() {
      const item = lightboxItems[lightboxIndex];
      lightboxImg.classList.add("fade-out");
      setTimeout(() => {
        lightboxImg.src = item.src;
        lightboxImg.alt = item.title;
        lightboxTitle.textContent = item.title;
        lightboxMeta.textContent  = item.meta;
        lightboxImg.classList.remove("fade-out");
      }, 150);
      const prevBtn = document.getElementById("lightboxPrev");
      const nextBtn = document.getElementById("lightboxNext");
      const single  = lightboxItems.length <= 1;
      prevBtn.hidden = single;
      nextBtn.hidden = single;
      if (!single) {
        prevBtn.disabled = lightboxIndex === 0;
        nextBtn.disabled = lightboxIndex === lightboxItems.length - 1;
      }
    }

    function closeLightbox() {
      lightboxEl.classList.remove("lightbox-open");
      lightboxEl.setAttribute("aria-hidden", "true");
    }

    function lightboxStep(dir) {
      const next = lightboxIndex + dir;
      if (next >= 0 && next < lightboxItems.length) {
        lightboxIndex = next;
        showLightboxFrame();
      }
    }

    /* ============================================================
       INIT GALLERY — EVENT WIRING
    ============================================================ */

    function initGallery() {
      document.getElementById("aiModelsBtn").addEventListener("click", openGallery);
      document.getElementById("galleryClose").addEventListener("click", closeGallery);
      document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
      document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
      document.getElementById("lightboxPrev").addEventListener("click", () => lightboxStep(-1));
      document.getElementById("lightboxNext").addEventListener("click", () => lightboxStep(1));

      document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          if (lightboxEl.classList.contains("lightbox-open")) { closeLightbox(); }
          else if (galleryEl.classList.contains("gallery-open")) { closeGallery(); }
        }
        if (lightboxEl.classList.contains("lightbox-open")) {
          if (e.key === "ArrowRight") lightboxStep(1);
          if (e.key === "ArrowLeft")  lightboxStep(-1);
        }
      });

      // Touch swipe in lightbox
      let _touchX = 0;
      lightboxEl.addEventListener("touchstart", e => { _touchX = e.touches[0].clientX; }, { passive:true });
      lightboxEl.addEventListener("touchend",   e => {
        const dx = e.changedTouches[0].clientX - _touchX;
        if (Math.abs(dx) > 50) lightboxStep(dx < 0 ? 1 : -1);
      });

      // Card click / keyboard delegation
      function delegateCards(gridId, set) {
        const grid = document.getElementById(gridId);
        grid.addEventListener("click", e => {
          const card = e.target.closest(".gallery-card");
          if (card) openLightbox(set, parseInt(card.dataset.lightboxIndex, 10));
        });
        grid.addEventListener("keydown", e => {
          if (e.key === "Enter" || e.key === " ") {
            const card = e.target.closest(".gallery-card");
            if (card) { e.preventDefault(); openLightbox(set, parseInt(card.dataset.lightboxIndex, 10)); }
          }
        });
      }
      delegateCards("modelsGrid",   "models");
      delegateCards("conceptsGrid", "concepts");

      // Family filter
      document.getElementById("familyFilters").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        galleryActiveFamily = chip.dataset.family;
        updateFilterChips("familyFilters", "family", galleryActiveFamily);
        renderModels();
      });

      // Size filter
      document.getElementById("sizeFilters").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        galleryActiveSize = chip.dataset.size;
        updateFilterChips("sizeFilters", "size", galleryActiveSize);
        renderModels();
      });

      // Concept group filter
      document.getElementById("conceptFilters").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        conceptActiveGroup = chip.dataset.concept;
        updateFilterChips("conceptFilters", "concept", conceptActiveGroup);
        renderConcepts();
      });
    }

    initGallery();

    /* ============================================================
       BLOCKCHAIN ARCHITECTURE GALLERY — DATA & LOGIC
    ============================================================ */

    const BLOCKCHAINS = [
      { name:"Bitcoin",       ticker:"BTC",  layer:"L1", consensus:"PoW",        ecosystem:"Bitcoin",   year:2009, desc:"Original peer-to-peer cash. Nakamoto consensus, UTXO model, SHA-256 mining.",            whitepaper:"https://bitcoin.org/bitcoin.pdf" },
      { name:"Ethereum",      ticker:"ETH",  layer:"L1", consensus:"PoS",        ecosystem:"Ethereum",  year:2015, desc:"Programmable blockchain. EVM, smart contracts, Gasper proof-of-stake consensus.",        whitepaper:"https://ethereum.org/en/whitepaper/" },
      { name:"Solana",        ticker:"SOL",  layer:"L1", consensus:"PoH",        ecosystem:"Solana",    year:2020, desc:"High-throughput L1. Proof-of-History clock + Tower BFT. Sealevel parallel VM.",          whitepaper:"https://solana.com/solana-whitepaper.pdf" },
      { name:"Cardano",       ticker:"ADA",  layer:"L1", consensus:"PoS",        ecosystem:"Cardano",   year:2017, desc:"Peer-reviewed design. Ouroboros PoS, eUTXO model, Plutus smart contracts.",              whitepaper:"https://docs.cardano.org/about-cardano/overview" },
      { name:"Polkadot",      ticker:"DOT",  layer:"L0", consensus:"NPoS",       ecosystem:"Polkadot",  year:2020, desc:"Multichain relay network. Nominated PoS, parachain sharding, XCM cross-chain messaging.", whitepaper:"https://polkadot.com/papers/polkadot-lightpaper.pdf" },
      { name:"Avalanche",     ticker:"AVAX", layer:"L1", consensus:"Snowball",   ecosystem:"Avalanche", year:2020, desc:"Triple-chain architecture (X/P/C). Snowflake/Snowball consensus, sub-second finality.",   whitepaper:"https://assets.website-files.com/5d80307810123f5ffbb34d6e/6008d7bc56430d6b8792b8d1_Avalanche%20Platform%20Whitepaper.pdf" },
      { name:"Cosmos",        ticker:"ATOM", layer:"L0", consensus:"BFT",        ecosystem:"Cosmos",    year:2019, desc:"Internet of Blockchains. Tendermint BFT, IBC protocol, app-specific chain architecture.", whitepaper:"https://cosmos.network/cosmos-whitepaper.pdf" },
      { name:"BNB Chain",     ticker:"BNB",  layer:"L1", consensus:"PoSA",       ecosystem:"BNB",       year:2020, desc:"EVM-compatible high-throughput chain. Proof-of-Staked-Authority with 21 validators.",      whitepaper:"https://github.com/bnb-chain/whitepaper/blob/master/WHITEPAPER.md" },
      { name:"NEAR Protocol", ticker:"NEAR", layer:"L1", consensus:"PoS",        ecosystem:"NEAR",      year:2020, desc:"Sharded L1. Nightshade sharding, Doomslug PoS, account-based model, Rainbow Bridge.",    whitepaper:"https://near.org/papers/the-official-near-white-paper/" },
      { name:"Sui",           ticker:"SUI",  layer:"L1", consensus:"BFT",        ecosystem:"Sui",       year:2023, desc:"Object-centric L1. Mysticeti BFT, Move VM, parallel object execution, DAG mempool.",      whitepaper:"https://docs.sui.io/paper/sui.pdf" },
      { name:"Aptos",         ticker:"APT",  layer:"L1", consensus:"BFT",        ecosystem:"Aptos",     year:2022, desc:"Move-based L1. Block-STM parallel execution engine, DiemBFT v4 consensus protocol.",      whitepaper:"https://aptos.dev/assets/files/Aptos-Whitepaper-47099b4b907b432f81fc0effd34f3b6a.pdf" },
      { name:"Arbitrum",      ticker:"ARB",  layer:"L2", consensus:"Optimistic", ecosystem:"Arbitrum",  year:2021, desc:"Optimistic rollup on Ethereum. Nitro engine, interactive fraud proofs, EVM equivalence.",  whitepaper:"https://github.com/OffchainLabs/nitro/blob/master/docs/Nitro-whitepaper.pdf" },
      { name:"Optimism",      ticker:"OP",   layer:"L2", consensus:"Optimistic", ecosystem:"Optimism",  year:2021, desc:"OP Stack modular rollup. Bedrock architecture, fault proofs, EVM-equivalent execution.",   whitepaper:"https://community.optimism.io/docs/protocol/" },
      { name:"Polygon",       ticker:"POL",  layer:"L2", consensus:"ZK",         ecosystem:"Polygon",   year:2021, desc:"ZK rollup with zkEVM. Plonky2 proving system, EVM equivalence, AggLayer aggregation.",    whitepaper:"https://polygon.technology/papers/pol-whitepaper" },
      { name:"Base",          ticker:"BASE", layer:"L2", consensus:"Optimistic", ecosystem:"Base",      year:2023, desc:"Coinbase OP Stack rollup. Bedrock fork, EVM-equivalent execution, no native gas token.",   whitepaper:"https://base.mirror.xyz/jjQnUq_UNTQOk7psnGBFop02-bLgqiqgrn9ZVFkiJj4" },
      { name:"zkSync Era",    ticker:"ZK",   layer:"L2", consensus:"ZK",         ecosystem:"zkSync",    year:2023, desc:"ZK rollup with zkEVM. Boojum proof system, native account abstraction, zkPorter DA.",      whitepaper:"https://zksync.io/whitepaper.pdf" },
      { name:"Stellar",       ticker:"XLM",  layer:"L1", consensus:"SCP",        ecosystem:"Stellar",   year:2014, desc:"Federated Byzantine agreement. Stellar Consensus Protocol, built-in DEX, fast payments.",  whitepaper:"https://www.stellar.org/papers/stellar-consensus-protocol" },
      { name:"Algorand",      ticker:"ALGO", layer:"L1", consensus:"PoS",        ecosystem:"Algorand",  year:2019, desc:"Pure PoS with cryptographic sortition. Immediate finality, no forks, AVM smart contracts.", whitepaper:"https://algorandcom.cdn.prismic.io/algorandcom/d5407f96-8e7d-4418-9ce4-0ce9e42ab087_theoretical.pdf" },
    ];

    const CHAIN_COLORS = {
      "Bitcoin":   "#f7931a",
      "Ethereum":  "#627eea",
      "Solana":    "#9945ff",
      "Cardano":   "#0033ad",
      "Polkadot":  "#e6007a",
      "Avalanche": "#e84142",
      "Cosmos":    "#2fb4c0",
      "BNB":       "#f0b90b",
      "NEAR":      "#00c08b",
      "Sui":       "#4da2ff",
      "Aptos":     "#00d1d5",
      "Arbitrum":  "#28a0f0",
      "Optimism":  "#ff0420",
      "Polygon":   "#8247e5",
      "Base":      "#0052ff",
      "zkSync":    "#4e529a",
      "Stellar":   "#08b5e5",
      "Algorand":  "#00b4d8"
    };

    let chainActiveLayer     = "all";
    let chainActiveConsensus = "all";
    let _cryptoScrollY       = 0;
    let chainLightboxItems   = [];

    function chainSVG(b) {
      const c  = CHAIN_COLORS[b.ecosystem] || "#6366f1";
      const short = b.desc.length > 72 ? b.desc.slice(0, 70) + "…" : b.desc;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260">
        <rect width="400" height="260" fill="#0f172a"/>
        <rect width="400" height="260" fill="${c}" fill-opacity=".12"/>
        <line x1="0" y1="65"  x2="400" y2="65"  stroke="${c}" stroke-opacity=".15" stroke-width="1"/>
        <line x1="0" y1="130" x2="400" y2="130" stroke="${c}" stroke-opacity=".15" stroke-width="1"/>
        <line x1="0" y1="195" x2="400" y2="195" stroke="${c}" stroke-opacity=".15" stroke-width="1"/>
        <line x1="133" y1="0" x2="133" y2="260" stroke="${c}" stroke-opacity=".1"  stroke-width="1"/>
        <line x1="266" y1="0" x2="266" y2="260" stroke="${c}" stroke-opacity=".1"  stroke-width="1"/>
        <rect x="0" y="0" width="4" height="260" fill="${c}"/>
        <text x="200" y="158" text-anchor="middle" font-family="monospace" font-size="88" font-weight="bold" fill="${c}" fill-opacity=".18">${b.ticker}</text>
        <text x="24"  y="52"  font-family="system-ui,sans-serif" font-size="26" font-weight="700" fill="white">${b.name}</text>
        <rect x="22"  y="64"  width="${b.consensus.length * 10 + 20}" height="22" rx="11" fill="${c}" fill-opacity=".25"/>
        <text x="${22 + b.consensus.length * 5 + 10}" y="79" text-anchor="middle" font-family="monospace" font-size="11" font-weight="600" fill="${c}">${b.consensus}</text>
        <rect x="${22 + b.consensus.length * 10 + 28}" y="64" width="34" height="22" rx="11" fill="white" fill-opacity=".08"/>
        <text x="${22 + b.consensus.length * 10 + 45}" y="79" text-anchor="middle" font-family="monospace" font-size="11" font-weight="600" fill="white" fill-opacity=".7">${b.layer}</text>
        <text x="24"  y="208" font-family="system-ui,sans-serif" font-size="12" fill="white" fill-opacity=".55">${short}</text>
        <text x="376" y="246" text-anchor="end" font-family="monospace" font-size="11" fill="white" fill-opacity=".35">est. ${b.year}</text>
      </svg>`;
      return "data:image/svg+xml," + encodeURIComponent(svg);
    }

    function renderChains() {
      const list = BLOCKCHAINS.filter(b => {
        const lm = chainActiveLayer     === "all" || b.layer     === chainActiveLayer;
        const cm = chainActiveConsensus === "all" || b.consensus === chainActiveConsensus;
        return lm && cm;
      });

      chainLightboxItems = list.map(b => ({
        src:   chainSVG(b),
        title: b.name,
        meta:  `${b.ticker} · ${b.layer} · ${b.consensus} · est. ${b.year}`
      }));

      document.getElementById("chainCount").textContent =
        list.length === BLOCKCHAINS.length
          ? `${BLOCKCHAINS.length} chains`
          : `${list.length} of ${BLOCKCHAINS.length} chains`;

      document.getElementById("chainGrid").innerHTML = list.map((b, i) => {
        const fc = CHAIN_COLORS[b.ecosystem] || "#6366f1";
        return `<article class="gallery-card" data-lightbox-index="${i}" style="--fc:${fc}" role="button" tabindex="0" aria-label="${b.name} architecture">
          <div class="gallery-card-img-wrap">
            <img class="gallery-card-img" src="${chainSVG(b)}" alt="${b.name} architecture diagram" loading="lazy" width="400" height="260">
            <div class="gallery-card-img-overlay"><span class="gallery-card-expand" aria-hidden="true">⤢</span></div>
          </div>
          <div class="gallery-card-body">
            <div class="gallery-card-meta">
              <span class="gallery-card-dot" style="background:${fc}"></span>
              <span class="gallery-card-family">${b.ticker} · ${b.layer}</span>
              <span class="gallery-card-size-badge">${b.consensus}</span>
            </div>
            <h3 class="gallery-card-name">${b.name}</h3>
            <a href="${b.whitepaper}" target="_blank" rel="noopener noreferrer"
               class="chain-wp-btn" aria-label="Read ${b.name} whitepaper"
               onclick="event.stopPropagation()">Whitepaper ↗</a>
          </div>
        </article>`;
      }).join("");
    }

    function openCrypto() {
      _cryptoScrollY = window.scrollY;
      const el = document.getElementById("cryptoGallery");
      el.classList.add("gallery-open");
      el.setAttribute("aria-hidden", "false");
      document.getElementById("cryptoBtn").setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      document.getElementById("cryptoContent").scrollTop = 0;
      if (!el.dataset.loaded) { renderChains(); el.dataset.loaded = "true"; }
      el.focus();
    }

    function closeCrypto() {
      const el = document.getElementById("cryptoGallery");
      el.classList.remove("gallery-open");
      el.setAttribute("aria-hidden", "true");
      document.getElementById("cryptoBtn").setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      window.scrollTo(0, _cryptoScrollY);
      document.getElementById("cryptoBtn").focus();
    }

    function initChain() {
      document.getElementById("cryptoBtn").addEventListener("click", openCrypto);
      document.getElementById("cryptoClose").addEventListener("click", closeCrypto);

      document.getElementById("chainLayerFilter").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        chainActiveLayer = chip.dataset.layer;
        updateFilterChips("chainLayerFilter", "layer", chainActiveLayer);
        renderChains();
      });

      document.getElementById("chainConsensusFilter").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        chainActiveConsensus = chip.dataset.cons;
        updateFilterChips("chainConsensusFilter", "cons", chainActiveConsensus);
        renderChains();
      });

      document.getElementById("chainGrid").addEventListener("click", e => {
        const card = e.target.closest(".gallery-card");
        if (!card || e.target.closest("a")) return;
        openLightbox(chainLightboxItems, parseInt(card.dataset.lightboxIndex));
      });

      document.getElementById("chainGrid").addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const card = e.target.closest(".gallery-card");
        if (card) openLightbox(chainLightboxItems, parseInt(card.dataset.lightboxIndex));
      });
    }

    initChain();
