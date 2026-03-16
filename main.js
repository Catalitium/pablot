    const TOOLS = [
      // Code
      {name:"API Builder",slug:"api-builder",category:"code",icon:"🔗",desc:"Visual API creation platform"},
      {name:"Case Converter",slug:"case-converter",category:"code",icon:"Aa",desc:"Convert case formats"},
      {name:"Cron Builder",slug:"cron-builder",category:"code",icon:"🕐",desc:"Build cron expressions"},
      {name:"CSS Minifier",slug:"css-minifier",category:"code",icon:"🎀",desc:"Minify CSS"},
      {name:"CURL Builder",slug:"curl-builder",category:"code",icon:"🌐",desc:"Build CURL commands"},
      {name:"Data Converter",slug:"data-converter",category:"code",icon:"🔄",desc:"CSV/JSON/YAML"},
      {name:"Hash Generator",slug:"hash-generator",category:"code",icon:"#️⃣",desc:"MD5/SHA hashes"},
      {name:"JSON Formatter",slug:"json-formatter",category:"code",icon:"{ }",desc:"Format JSON"},
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

      // Data
      {name:"Base64",slug:"base64",category:"data",icon:"🔤",desc:"Encode/decode Base64"},
      {name:"Binary Converter",slug:"binary-converter",category:"data",icon:"0️⃣",desc:"Binary/hex converter"},
      {name:"Image Compressor",slug:"image-compressor",category:"data",icon:"🖼️",desc:"Compress images"},
      {name:"URL Shortener",slug:"url-shortener",category:"data",icon:"✂️",desc:"Shorten URLs"},

      // Math
      {name:"Complex Plane",slug:"complex-plane",category:"math",icon:"📊",desc:"Julia sets visualization"},
      {name:"Fourier Visualizer",slug:"fourier-visualizer",category:"math",icon:"〰️",desc:"FFT decomposition"},
      {name:"Graphing Calculator",slug:"graphing-calculator",category:"math",icon:"📈",desc:"Plot functions"},
      {name:"Linear Solver",slug:"linear-solver",category:"math",icon:"➗",desc:"Solve linear equations"},
      {name:"Matrix Calculator",slug:"matrix-calculator",category:"math",icon:"🔢",desc:"Matrix operations"},

      // AI
      {name:"Token Counter",slug:"token-counter",category:"ai",icon:"🔢",desc:"Count tokens"},

      // Tools
      {name:"Aspect Ratio",slug:"aspect-ratio",category:"tools",icon:"📐",desc:"Image dimension calculator"},
      {name:"Countdown Timer",slug:"countdown-timer",category:"tools",icon:"⏱",desc:"Countdown to date"},
      {name:"Password Generator",slug:"password-generator",category:"tools",icon:"🔐",desc:"Secure passwords"},
      {name:"Timezone Converter",slug:"timezone-converter",category:"tools",icon:"🌍",desc:"Time zones"},
      {name:"Unit Converter",slug:"unit-converter",category:"tools",icon:"🔄",desc:"Convert units"},
      {name:"Word Counter",slug:"word-counter",category:"tools",icon:"📊",desc:"Count words"},
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

    const tabsEl      = document.getElementById("tabs");
    const toolsGridEl = document.getElementById("toolsGrid");
    const searchInput = document.getElementById("searchInput");
    const searchClear = document.getElementById("searchClear");
    const toolCount   = document.getElementById("toolCount");
    const headerEl    = document.querySelector(".header");

    function escapeHtml(str) {
      return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
    }

    function init() {
      const heroSub = document.getElementById("heroSub");
      if (heroSub) heroSub.textContent = `${TOOLS.length} live tools · ${WIP_TOOLS.length} in progress`;
      renderTabs();
      renderTools();
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
            <button class="tools-empty-clear" onclick="clearSearch()">Clear search</button>
          </div>`;
        return;
      }

      toolsGridEl.innerHTML = filtered.map(tool => `
        <a href="${escapeHtml(tool.slug)}/" class="tool-card" target="_blank" rel="noopener noreferrer">
          <div class="tool-icon">${tool.icon}</div>
          <div class="tool-name">${escapeHtml(tool.name)}</div>
          <div class="tool-desc">${escapeHtml(tool.desc)}</div>
        </a>`).join("");
    }

    function clearSearch() {
      searchInput.value = "";
      searchClear.hidden = true;
      renderTools("");
      searchInput.focus();
    }

    function initPageBehaviours() {
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
      { name:"DNA Helix",           slug:"dna-helix",           icon:"🔬", desc:"Interactive 3D DNA visualization",       type:"Web" },
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

    function openLightbox(set, index) {
      const items = set === "models"
        ? getFilteredModels().map(m => ({ src:`assets/architectures/${m.filename}.webp`, title:m.name, meta:`${m.family} · ${m.paramsLabel} parameters` }))
        : getFilteredConcepts().map(c => ({ src:`assets/concepts/${c.filename}.${c.ext}`,  title:c.name,  meta:c.group }));

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
       CRYPTO BLOCKCHAIN — STATE & LOGIC
    ============================================================ */

    let cryptoCurrency  = "usd";
    let _cryptoScrollY  = 0;

    const cryptoGallery = document.getElementById("cryptoGallery");
    const cryptoLoading = document.getElementById("cryptoLoading");
    const cryptoTableWrap = document.getElementById("cryptoTableWrap");
    const cryptoTbody   = document.getElementById("cryptoTbody");
    const cryptoErrorEl = document.getElementById("cryptoError");
    const cryptoErrorMsg = document.getElementById("cryptoErrorMsg");

    function openCrypto() {
      _cryptoScrollY = window.scrollY;
      cryptoGallery.classList.add("gallery-open");
      cryptoGallery.setAttribute("aria-hidden", "false");
      document.getElementById("cryptoBtn").setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      document.getElementById("cryptoContent").scrollTop = 0;
      if (!cryptoGallery.dataset.loaded) { loadCrypto(); }
      cryptoGallery.focus();
    }

    function closeCrypto() {
      cryptoGallery.classList.remove("gallery-open");
      cryptoGallery.setAttribute("aria-hidden", "true");
      document.getElementById("cryptoBtn").setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      window.scrollTo(0, _cryptoScrollY);
      document.getElementById("cryptoBtn").focus();
    }

    function fmtPrice(n, currency) {
      if (n === null || n === undefined) return "—";
      return new Intl.NumberFormat("en-US", {
        style: "currency", currency: currency.toUpperCase(),
        minimumFractionDigits: n < 1 ? 4 : n < 100 ? 2 : 0,
        maximumFractionDigits: n < 1 ? 6 : n < 100 ? 2 : 0
      }).format(n);
    }

    function fmtBig(n, currency) {
      if (n === null || n === undefined) return "—";
      const sym = { usd:"$", eur:"€", gbp:"£" }[currency] || "$";
      if (n >= 1e12) return sym + (n / 1e12).toFixed(2) + "T";
      if (n >= 1e9)  return sym + (n / 1e9).toFixed(2)  + "B";
      if (n >= 1e6)  return sym + (n / 1e6).toFixed(2)  + "M";
      return sym + n.toLocaleString();
    }

    function fmtChange(pct) {
      if (pct === null || pct === undefined) return '<span class="crypto-change">—</span>';
      const cls = pct >= 0 ? "crypto-change--pos" : "crypto-change--neg";
      const arrow = pct >= 0 ? "▲" : "▼";
      return `<span class="crypto-change ${cls}">${arrow} ${Math.abs(pct).toFixed(2)}%</span>`;
    }

    async function loadCrypto() {
      cryptoErrorEl.hidden = true;
      cryptoTableWrap.hidden = true;
      cryptoLoading.style.display = "flex";

      const refreshBtn = document.getElementById("cryptoRefresh");
      refreshBtn.classList.add("spinning");

      try {
        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cryptoCurrency}&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h%2C7d`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const coins = await res.json();

        cryptoTbody.innerHTML = coins.map((c, i) => `
          <tr class="crypto-row">
            <td class="crypto-td crypto-td--rank">${i + 1}</td>
            <td class="crypto-td">
              <div class="crypto-coin">
                <img class="crypto-coin-img" src="${c.image}" alt="${c.name} logo" loading="lazy" width="28" height="28">
                <div>
                  <div class="crypto-coin-name">${c.name}</div>
                  <div class="crypto-coin-symbol">${c.symbol}</div>
                </div>
              </div>
            </td>
            <td class="crypto-td crypto-td--num">${fmtPrice(c.current_price, cryptoCurrency)}</td>
            <td class="crypto-td crypto-td--num">${fmtChange(c.price_change_percentage_24h)}</td>
            <td class="crypto-td crypto-td--num">${fmtChange(c.price_change_percentage_7d_in_currency)}</td>
            <td class="crypto-td crypto-td--num crypto-cap">${fmtBig(c.market_cap, cryptoCurrency)}</td>
            <td class="crypto-td crypto-td--num crypto-td--vol">${fmtBig(c.total_volume, cryptoCurrency)}</td>
          </tr>`).join("");

        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        document.getElementById("cryptoLastUpdated").textContent = `Live market data · Updated ${now}`;
        cryptoGallery.dataset.loaded = "true";
        cryptoTableWrap.hidden = false;
      } catch (err) {
        cryptoErrorMsg.textContent = `Failed to load market data: ${err.message}. Check your connection and try again.`;
        cryptoErrorEl.hidden = false;
      } finally {
        cryptoLoading.style.display = "none";
        refreshBtn.classList.remove("spinning");
      }
    }

    function initCrypto() {
      document.getElementById("cryptoBtn").addEventListener("click", openCrypto);
      document.getElementById("cryptoClose").addEventListener("click", closeCrypto);
      document.getElementById("cryptoRefresh").addEventListener("click", loadCrypto);

      document.getElementById("cryptoCurrencyFilter").addEventListener("click", e => {
        const chip = e.target.closest(".filter-chip");
        if (!chip) return;
        cryptoCurrency = chip.dataset.currency;
        document.getElementById("cryptoCurrencyFilter").querySelectorAll(".filter-chip").forEach(c => {
          c.classList.toggle("active", c.dataset.currency === cryptoCurrency);
          c.setAttribute("aria-checked", c.dataset.currency === cryptoCurrency ? "true" : "false");
        });
        cryptoGallery.dataset.loaded = "";
        loadCrypto();
      });
    }

    initCrypto();
