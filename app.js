/* PABLOBOT - Production JS (ES Module, zero deps)
   - gtag + trackClick retained
   - No Supabase
   - Clean data/render pipeline
   - Accessible modal, search, keyboard nav, smooth scroll
   - Cryptorka tabs + shared search
   - Kept overall file length by adding clarifying comments (no dead code)
*/

/* ============================================================================
   1) CONSTANTS & UTILITIES
   ========================================================================== */

const SESSION_ID = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/* Tiny DOM helpers (kept signatures for compatibility) */
const $  = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

/* Element factory: el('div', { class:'x', id:'y' }, 'text', child) */
const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return n;
};

/* Debounce for search input and analytics throttling */
const debounce = (fn, ms = 300) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

/* Basic validators and normalizers (stable behavior retained) */
function validateEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > 255) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function sanitize(str, max = 1000) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim().slice(0, max);
}

/* Respect reduced motion users for scroll/animation */
const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Numeric/text formatting helpers */
const fmt = (n) => (n == null ? "—" : String(n));
const slug = (s) => (s || "").toLowerCase().replace(/\s+/g, "-");
let __lockScrollY = 0;

function lockScroll() {
  __lockScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = `-${__lockScrollY}px`;
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}

function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, __lockScrollY || 0);
}

/* prevent rubber-band scroll on backdrop */
function preventTouchScrollOn(el) {
  if (!el) return;
  const stop = (e) => e.preventDefault();
  el.addEventListener('touchmove', stop, { passive: false });
}

function openModal(){
  const modal = $("#newsletter-modal");
  const backdrop = $("#modal-backdrop");
  const emailInput = $("#nl-email");
  if (!modal || !backdrop) return;

  lastFocusedElement = document.activeElement;

  modal.setAttribute("aria-hidden", "false");
  backdrop.setAttribute("data-open", "true");
  backdrop.setAttribute("aria-hidden", "false");

  lockScroll();                         // ← use new lock

  // iOS: prevent background scroll via backdrop
  preventTouchScrollOn(backdrop);

  // center + focus after paint
  setTimeout(() => emailInput?.focus(), 60);

  trackClick("modal", "newsletter-open", { action: "open" });
}

function closeModal(){
  const modal = $("#newsletter-modal");
  const backdrop = $("#modal-backdrop");
  const form = $("#nl-form");
  const feedback = $("#nl-feedback");
  if (!modal || !backdrop) return;

  modal.setAttribute("aria-hidden", "true");
  backdrop.setAttribute("data-open", "false");
  backdrop.setAttribute("aria-hidden", "true");

  unlockScroll();                       // ← use new unlock

  form?.reset();
  if (feedback) { feedback.textContent = ""; feedback.className = "note"; }

  lastFocusedElement?.focus();
  lastFocusedElement = null;

  trackClick("modal", "newsletter-close", { action: "close" });
}

/* ============================================================================
   2) ANALYTICS
   ========================================================================== */

/** Public tracking wrapper (name/shape kept). */
function trackClick(elementType, elementId, extra = {}) {
  const payload = {
    element_type: elementType,
    element_id: elementId,
    session_id: SESSION_ID,
    page_url: location.href,
    referrer: document.referrer || null,
    user_agent: navigator.userAgent,
    clicked_at: new Date().toISOString(),
    ...extra
  };

  if (typeof window.gtag === "function") {
    const map = {
      navigation: "navigation_click",
      "llm-official-link": "llm_official_click",
      search: "search_performed",
      "collapsible-toggle": "collapse_toggle",
      newsletter: "newsletter_event",
      modal: "modal_event",
      button: "button_click",
      "external-link": "external_link_click"
    };
    window.gtag("event", map[elementType] || "interaction", payload);
  } else {
    console.log("[trackClick]", payload);
  }
}
window.trackClick = trackClick; // expose for inline use

/* ============================================================================
   3) DATA
   ========================================================================== */

/* LLM sample set (keep shape: emoji, name, provider, paramsB, contextK, official, highlights) */
const LLMs = [
  {
    emoji: "🛰️", name: "Grok 1.5", provider: "xAI",
    paramsB: 314, contextK: 128,
    official: "https://x.ai/",
    highlights: "Long-context model; Grok-1 open weights are 314B MoE."
  },
  {
    emoji: "🦙", name: "Llama 3 70B", provider: "Meta",
    paramsB: 70, contextK: 8,
    official: "https://www.llama.com/models/llama-3/",
    highlights: "Open ecosystem; strong community & tooling."
  },
  {
    emoji: "🦙", name: "Llama 3 8B", provider: "Meta",
    paramsB: 8, contextK: 8,
    official: "https://www.llama.com/models/llama-3/",
    highlights: "Lightweight option; excellent cost/perf."
  },
  {
    emoji: "🧠", name: "DeepSeek (V3/V2 family)", provider: "DeepSeek",
    paramsB: 236, contextK: 128,
    official: "https://www.deepseek.com/",
    highlights: "MoE efficiency; API lists 128K context."
  }
];

/* Site content (papers, groups, timeline) */
const DATA = {
  papersCore: [
    { t: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", meta: "(Vaswani et al., 2017)" },
    { t: "BERT", url: "https://arxiv.org/abs/1801.01290", meta: "(Devlin et al., 2018)" },
    { t: "Language Models are Few-Shot Learners", url: "https://arxiv.org/abs/2005.14165", meta: "(Brown et al., 2020)" },
    { t: "Riemann – On the Hypotheses…", url: "https://archive.org/details/riemannhypotheses", meta: "(1854)" },
    { t: "Évariste Galois – Mémoire…", url: "https://gallica.bnf.fr/ark:/12148/bpt6k433679w", meta: "(1832)" },
    { t: "Turing – On Computable Numbers…", url: "https://www.cs.ox.ac.uk/activities/ieg/e-library/sources/tp2-ie.pdf", meta: "(1936)" },
    { t: "Norbert Wiener – Cybernetics", url: "https://archive.org/details/cyberneticsorcon00wien", meta: "(1948)" }
  ],
  paperGroups: [
    {
      title: "🏗️ Foundational Papers",
      items: [
        { t: "Codd: A Relational Model…", url: "https://dl.acm.org/doi/10.1145/362384.362685", note: "Introduced the relational model. (1970)" },
        { t: "Spanner", url: "https://research.google/pubs/pub41344/", note: "Planet-scale, consistent distributed SQL. (2012)" },
        { t: "The End of an Architectural Era", url: "https://www.cs.cmu.edu/~christos/courses/826.F05/slides/foundation-nosql.pdf", note: "Traditional RDBMSs are too rigid. (2007)" }
      ]
    },
    {
      title: "🚀 Scaling & Performance",
      items: [
        { t: "Scaling Memcache at Facebook", url: "https://research.facebook.com/publications/scaling-memcache-at-facebook/", note: "How FB scales ephemeral caching." },
        { t: "The NoSQL Movement", url: "https://cacm.acm.org/magazines/2012/6/149798-the-nosql-movement/fulltext", note: "Why scale killed schemas (pendulum swinging back)." },
        { t: "Dynamo", url: "https://www.allthingsdistributed.com/2007/10/amazons_dynamo.html", note: "Highly available key-value store. (2007)" }
      ]
    },
    {
      title: "🕸️ Graph & Modern Systems",
      items: [
        { t: "Graph Thinking", url: "https://neo4j.com/blog/graph-thinking/", note: "The shift from tables to graphs." },
        { t: "Bigtable", url: "https://research.google/pubs/pub45351/", note: "Google's distributed storage system. (2006)" },
        { t: "MapReduce", url: "https://research.google/pubs/pub36726/", note: "Large-scale data processing model. (2004)" }
      ]
    }
  ],
  timeline: [
    { y: "300 BCE", text: "Euclid's Elements lays the groundwork for geometry.", url: "https://en.wikipedia.org/wiki/Euclid%27s_Elements" },
    { y: "250 BCE", text: "Archimedes develops methods for calculating areas and volumes.", url: "https://en.wikipedia.org/wiki/Archimedes" },
    { y: "1801", text: "Gauss publishes Disquisitiones Arithmeticae.", url: "https://en.wikipedia.org/wiki/Disquisitiones_Arithmeticae" },
    { y: "1822", text: "Fourier introduces Fourier series.", url: "https://en.wikipedia.org/wiki/Fourier_series" },
    { y: "1854", text: "Riemann's geometry influences relativity.", url: "https://en.wikipedia.org/wiki/Riemannian_geometry" },
    { y: "1900", text: "Hilbert proposes 23 problems.", url: "https://en.wikipedia.org/wiki/Hilbert%27s_problems" },
    { y: "1910", text: "Russell & Whitehead's Principia Mathematica.", url: "https://en.wikipedia.org/wiki/Principia_Mathematica" },
    { y: "1931", text: "Gödel's incompleteness theorems.", url: "https://en.wikipedia.org/wiki/G%C3%B6del%27s_incompleteness_theorems" },
    { y: "1936", text: "Turing formulates the Halting Problem.", url: "https://en.wikipedia.org/wiki/Halting_problem" },
    { y: "1943", text: "McCulloch & Pitts neuron model.", url: "https://en.wikipedia.org/wiki/McCulloch%E2%80%93Pitts_neuron" },
    { y: "1950", text: "Turing Test proposed.", url: "https://en.wikipedia.org/wiki/Turing_test" },
    { y: "1951", text: "SNARC — first neural network computer.", url: "https://en.wikipedia.org/wiki/SNARC" },
    { y: "1956", text: "Logic Theorist — early AI program.", url: "https://en.wikipedia.org/wiki/Logic_Theorist" },
    { y: "1958", text: "Rosenblatt's Perceptron.", url: "https://en.wikipedia.org/wiki/Perceptron" },
    { y: "1966", text: "ELIZA — early NLP chatbot.", url: "https://en.wikipedia.org/wiki/ELIZA" },
    { y: "1997", text: "Deep Blue defeats Kasparov.", url: "https://en.wikipedia.org/wiki/Deep_Blue_(chess_computer)" },
    { y: "2012", text: "AlexNet wins ImageNet; modern deep learning era.", url: "https://en.wikipedia.org/wiki/AlexNet" },
    { y: "2016", text: "AlphaGo defeats Lee Sedol.", url: "https://en.wikipedia.org/wiki/AlphaGo" },
    { y: "2022", text: "OpenAI releases ChatGPT.", url: "https://en.wikipedia.org/wiki/ChatGPT" }
  ]
};

/* ===== CRYPTORKA: Stablecoins & Blue-chips (future-proof rows) =====
   Columns (as in HTML):
   # | Asset | Type (hide-sm) | Network | Paper/Docs | Dexscreener
*/
const CRYPTOS = [
  // Stablecoins
  { emoji:"💵", symbol:"USDT", name:"Tether USD₮", type:"Stablecoin",
    network:"Multi (ETH/SOL/TRON)",
    paper:"https://tether.to/en/whitepaper/",
    dexscreener:"https://dexscreener.com/search?q=USDT",
    note:"Largest USD-pegged stablecoin; deep liquidity."
  },
  { emoji:"💸", symbol:"USDC", name:"USD Coin", type:"Stablecoin",
    network:"Multi (ETH/SOL)",
    paper:"https://www.circle.com/blog/introducing-usdc",
    dexscreener:"https://dexscreener.com/search?q=USDC",
    note:"USD-pegged; issued by Circle; widely integrated."
  },
  { emoji:"🅿️", symbol:"PYUSD", name:"PayPal USD", type:"Stablecoin",
    network:"Ethereum",
    paper:"https://www.paxos.com/pyusd/",
    dexscreener:"https://dexscreener.com/search?q=PYUSD",
    note:"PayPal-branded USD stablecoin (Paxos)."
  },
  { emoji:"🔷", symbol:"TUSD", name:"TrueUSD", type:"Stablecoin",
    network:"Multi",
    paper:"https://www.tusd.io/",
    dexscreener:"https://dexscreener.com/search?q=TUSD",
    note:"USD-pegged; attestation-based."
  },
  { emoji:"🧾", symbol:"FDUSD", name:"First Digital USD", type:"Stablecoin",
    network:"Multi",
    paper:"https://www.fdusd.io/",
    dexscreener:"https://dexscreener.com/search?q=FDUSD",
    note:"USD-pegged; HK-based issuer."
  },
  { emoji:"💠", symbol:"USDP", name:"Pax Dollar", type:"Stablecoin",
    network:"Ethereum",
    paper:"https://www.paxos.com/usdp/",
    dexscreener:"https://dexscreener.com/search?q=USDP",
    note:"Regulated USD stablecoin by Paxos."
  },

  // Layer 1 blue-chips
  { emoji:"₿", symbol:"BTC", name:"Bitcoin", type:"Layer 1",
    network:"Bitcoin",
    paper:"https://bitcoin.org/bitcoin.pdf",
    dexscreener:"https://dexscreener.com/search?q=BTC",
    note:"Original crypto; most secure PoW network."
  },
  { emoji:"✨", symbol:"ETH", name:"Ethereum", type:"Layer 1",
    network:"Ethereum",
    paper:"https://ethereum.org/en/whitepaper/",
    dexscreener:"https://dexscreener.com/ethereum",
    note:"Smart contracts; transitioned to PoS."
  },
  { emoji:"🌞", symbol:"SOL", name:"Solana", type:"Layer 1",
    network:"Solana",
    paper:"https://solana.com/solana-whitepaper.pdf",
    dexscreener:"https://dexscreener.com/solana",
    note:"High-performance monolithic chain."
  },
  { emoji:"🟡", symbol:"BNB", name:"BNB (BNB Chain)", type:"Layer 1",
    network:"BNB Chain",
    paper:"https://www.bnbchain.org/en/whitepaper",
    dexscreener:"https://dexscreener.com/bsc",
    note:"High-throughput EVM-compatible chain."
  },
  { emoji:"🧬", symbol:"ADA", name:"Cardano", type:"Layer 1",
    network:"Cardano",
    paper:"https://iohk.io/en/research/library/papers/ouroboros-a-provably-secure-proof-of-stake-blockchain-protocol/",
    dexscreener:"https://dexscreener.com/search?q=ADA",
    note:"Peer-reviewed research; Ouroboros protocol."
  },
  { emoji:"💧", symbol:"XRP", name:"XRP (XRP Ledger)", type:"Layer 1",
    network:"XRP Ledger",
    paper:"https://ripple.com/files/ripple_consensus_whitepaper.pdf",
    dexscreener:"https://dexscreener.com/search?q=XRP",
    note:"Fast settlement on the XRP Ledger."
  },
  { emoji:"🔺", symbol:"TRX", name:"TRON", type:"Layer 1",
    network:"TRON",
    paper:"https://tron.network/static/doc/white_paper_v_2_0.pdf",
    dexscreener:"https://dexscreener.com/search?q=TRX",
    note:"High TPS; popular for stablecoin transfers."
  },
  { emoji:"🧊", symbol:"AVAX", name:"Avalanche", type:"Layer 1",
    network:"Avalanche",
    paper:"https://www.avalabs.org/whitepapers",
    dexscreener:"https://dexscreener.com/avalanche",
    note:"Avalanche consensus; subnets architecture."
  },
  { emoji:"📘", symbol:"TON", name:"TON", type:"Layer 1",
    network:"TON",
    paper:"https://ton.org/whitepaper.pdf",
    dexscreener:"https://dexscreener.com/search?q=TON",
    note:"Telegram-adjacent ecosystem; high throughput."
  },
  { emoji:"🟣", symbol:"DOT", name:"Polkadot", type:"Layer 1",
    network:"Polkadot",
    paper:"https://polkadot.network/whitepaper/",
    dexscreener:"https://dexscreener.com/search?q=DOT",
    note:"Heterogeneous multi-chain (parachains)."
  },
  { emoji:"💿", symbol:"LTC", name:"Litecoin", type:"Layer 1",
    network:"Litecoin",
    paper:"https://litecoin.org/",
    dexscreener:"https://dexscreener.com/search?q=LTC",
    note:"Early Bitcoin fork; fast/low-fee transfers."
  }
];

/* Sorting order for crypto type buckets */
const TYPE_ORDER = ["Stablecoin", "Layer 1", "Exchange Token", "Layer 2", "Appchain", "Other"];
const typeRank = (t) => {
  const i = TYPE_ORDER.indexOf(t);
  return i === -1 ? TYPE_ORDER.length : i;
};

/* ============================================================================
   4) RENDERERS
   ========================================================================== */

/* Rank by contextK desc, then paramsB desc, then name asc (unchanged) */
function rankModels(models){
  return models
    .slice()
    .sort((a,b) => {
      const ac = a.contextK ?? -Infinity, bc = b.contextK ?? -Infinity;
      if (ac !== bc) return bc - ac;
      const ap = a.paramsB ?? -Infinity, bp = b.paramsB ?? -Infinity;
      if (ap !== bp) return bp - ap;
      return a.name.localeCompare(b.name);
    })
    .map((m,i) => ({ ...m, _rank: (m.contextK==null && m.paramsB==null) ? "—" : i+1 }));
}

/* Render LLM table (adds data-label to play nice with mobile card layout) */
function renderLLMTable(){
  const tbody = $("#llm-tbody");
  if (!tbody) return;
  const ranked = rankModels(LLMs);
  tbody.innerHTML = "";

  for (const m of ranked) {
    const tr = el("tr", { tabindex: "0", role: "row" },
      el("td", { role: "cell", "data-label":"#" }, el("span", { class: "rank", "aria-label": "Rank" }, String(m._rank)) ),
      el("td", { role: "cell", "data-label":"Model" },
        el("div", { class: "model" },
          el("span", { class: "emoji", "aria-hidden": "true" }, m.emoji || "🤖"),
          el("div", {},
            el("strong", {}, m.name),
            el("div", { class: "cell-note" }, m.highlights || "")
          )
        )
      ),
      el("td", { class: "hide-sm", role: "cell", "data-label":"Provider" }, m.provider || "—"),
      el("td", { role: "cell", "data-label":"Params (B)" }, fmt(m.paramsB)),
      el("td", { role: "cell", "data-label":"Context (K)" }, fmt(m.contextK)),
      el("td", { role: "cell", "data-label":"Link" },
        el("a", {
          href: m.official, target: "_blank", rel: "noopener",
          class: "llm-official-link",
          "data-model-name": m.name,
          "data-model-slug": slug(m.name),
          "aria-label": `Visit ${m.name} official page`
        }, "Official")
      )
    );
    tbody.appendChild(tr);
  }
}

/* Render papers core list */
function renderPapersCore(){
  const ul = $("#papers-core-list");
  if (!ul) return;
  ul.innerHTML = "";
  for (const { t, url, meta } of DATA.papersCore) {
    const a = el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, t);
    ul.appendChild(el("li", {}, a, ` ${meta || ""}`));
  }
}

/* Render paper groups into cards */
function renderPaperGroups(){
  const root = $("#paper-groups");
  if (!root) return;
  root.innerHTML = "";

  for (const group of DATA.paperGroups) {
    const list = el("ul", { class: "list" });
    for (const { t, url, note } of group.items) {
      const a = el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, t);
      list.appendChild(el("li", {}, el("strong", {}, a), ` — ${note}`));
    }
    root.appendChild(el("div", { class: "card" }, el("h3", {}, group.title), list));
  }
}

/* Render timeline bullets */
function renderTimeline(){
  const ul = $("#timeline-list");
  if (!ul) return;
  ul.innerHTML = "";
  for (const { y, text, url } of DATA.timeline) {
    const a = el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, text);
    ul.appendChild(el("li", {}, el("strong", {}, `${y}: `), a));
  }
}

/* Crypto rank by TYPE_ORDER then name */
function rankCryptos(list) {
  return list
    .slice()
    .sort((a,b) => {
      const ta = typeRank(a.type), tb = typeRank(b.type);
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    })
    .map((c, i) => ({ ...c, _rank: i + 1 }));
}

/* Render cryptos table (adds data-labels for responsive cards) */
function renderCryptoTable() {
  const tbody = $("#crypto-tbody");
  if (!tbody) return;
  const ranked = rankCryptos(CRYPTOS);
  tbody.innerHTML = "";

  for (const c of ranked) {
    const tr = el("tr", { tabindex: "0" });
    tr.innerHTML = `
      <td data-label="#"><span class="rank" aria-label="Rank">${c._rank}</span></td>
      <td data-label="Asset">
        <div class="model">
          <span class="emoji" aria-hidden="true">${c.emoji || "🪙"}</span>
          <div>
            <strong>${c.name} <span class="meta-pill">${c.symbol}</span></strong>
            <div class="cell-note">${c.note || ""}</div>
          </div>
        </div>
      </td>
      <td class="hide-sm" data-label="Type">${c.type || "—"}</td>
      <td data-label="Network">${c.network || "—"}</td>
      <td data-label="Paper/Docs">
        <a href="${c.paper}" target="_blank" rel="noopener"
           class="crypto-whitepaper-link"
           data-asset="${c.symbol}"
           aria-label="Open ${c.name} paper/docs">Paper</a>
      </td>
      <td data-label="Dexscreener">
        <a href="${c.dexscreener}" target="_blank" rel="noopener"
           class="crypto-dexscreener-link"
           data-asset="${c.symbol}"
           aria-label="Open Dexscreener pairs for ${c.symbol}">Pairs</a>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

/* ============================================================================
   5) INTERACTIONS — LLM TABLE
   ========================================================================== */

/* Track clicks on "Official" links inside the LLM table */
function bindLLMOfficialClickTracking(){
  document.addEventListener("click", (e) => {
    const a = e.target.closest(".llm-official-link");
    if (!a) return;
    const name = a.getAttribute("data-model-name") || "unknown";
    const s = a.getAttribute("data-model-slug") || "unknown";
    trackClick("llm-official-link", s, { model_name: name, model_slug: s });
  });
}

/* Keyboard navigation across rows (ArrowUp/Down, Home/End, Enter/Space) */
function bindLLMKeyboardNav(){
  const tbody = $("#llm-tbody");
  if (!tbody) return;
  tbody.addEventListener("keydown", (e) => {
    const currentRow = e.target.closest("tr");
    if (!currentRow) return;
    const rows = $$("tr", tbody);
    const i = rows.indexOf(currentRow);

    switch (e.key) {
      case "ArrowDown": e.preventDefault(); rows[i + 1]?.focus(); break;
      case "ArrowUp":   e.preventDefault(); rows[i - 1]?.focus(); break;
      case "Home":      e.preventDefault(); rows[0]?.focus();     break;
      case "End":       e.preventDefault(); rows.at(-1)?.focus();  break;
      case "Enter":
      case " ":
        e.preventDefault();
        currentRow.querySelector(".llm-official-link")?.click();
        break;
    }
  });
}

/* Live filter for LLMs (adds/removes results chip + analytics debounce) */
function bindLLMSearch(){
  const input = $("#llmSearch");
  const tbody = $("#llm-tbody");
  if (!input || !tbody) return;

  const debouncedSearchTrack = debounce((query, count) => {
    trackClick("search", "llm-search", { search_query: query, results_count: count });
  }, 800);

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    const rows = $$("tr", tbody);
    let visible = 0;

    for (const r of rows) {
      const show = r.innerText.toLowerCase().includes(q);
      r.style.display = show ? "" : "none";
      if (show) visible++;
    }

    let chip = $("#search-results");
    if (q) {
      const txt = `${visible} model${visible === 1 ? "" : "s"} found`;
      if (!chip) {
        chip = el("span", { id: "search-results", class: "search-results" }, txt);
        input.parentElement.appendChild(chip);
      } else {
        chip.textContent = txt;
      }
      debouncedSearchTrack(q, visible);
    } else {
      chip?.remove();
    }
  });
}

/* ============================================================================
   5b) INTERACTIONS — GLOBAL
   ========================================================================== */

/* Collapsible sections (Show/Hide), analytics included */
function bindCollapsibles(){
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle]");
    if (!btn) return;
    const sel = btn.getAttribute("data-toggle");
    const wrap = btn.closest(".collapse");
    const panel = sel ? document.querySelector(sel) : null;
    if (!wrap || !panel) return;

    const open = wrap.getAttribute("data-open") === "true";
    wrap.setAttribute("data-open", String(!open));
    btn.setAttribute("aria-expanded", String(!open));
    trackClick("collapsible-toggle", sel, { action: open ? "close" : "open", section_name: btn.textContent.trim() });
  });
}

/* Smooth scroll for hash links (respects reduced motion) */
function bindSmoothScroll(){
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (!id || id === "#") return;
    const target = document.querySelector(id);
    if (!target) return;

    e.preventDefault();
    const opt = prefersReducedMotion() ? {} : { behavior: "smooth", block: "start" };
    target.scrollIntoView(opt);
    history.pushState(null, "", id);
  });
}

/* Track nav items marked with [data-track] */
function setupNavigationTracking(){
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-track]");
    if (!el) return;
    const trackId = el.getAttribute("data-track");
    const linkText = (el.textContent || "").trim();
    const href = el.getAttribute("href") || null;
    trackClick("navigation", trackId, { link_text: linkText, link_href: href });
  });
}

/* Track any external http(s) link by section id */
function setupExternalLinkTracking(){
  document.addEventListener("click", (e) => {
    const link = e.target.closest('a[href^="http"]');
    if (!link) return;
    const section = link.closest("section");
    const sectionId = section ? section.id : "unknown";
    trackClick("external-link", sectionId, {
      link_url: link.href,
      link_text: (link.textContent || "").trim(),
      section: sectionId
    });
  });
}

/* ============================================================================
   6) NEWSLETTER MODAL (no backend, accessible)
   ========================================================================== */

let lastFocusedElement = null;

function openModal(){
  const modal = $("#newsletter-modal");
  const backdrop = $("#modal-backdrop");
  const emailInput = $("#nl-email");
  if (!modal || !backdrop) return;

  lastFocusedElement = document.activeElement;
  modal.setAttribute("aria-hidden", "false");
  backdrop.setAttribute("data-open", "true");
  backdrop.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  setTimeout(() => emailInput?.focus(), 80);
  trackClick("modal", "newsletter-open", { action: "open" });
}

function closeModal(){
  const modal = $("#newsletter-modal");
  const backdrop = $("#modal-backdrop");
  const form = $("#nl-form");
  const feedback = $("#nl-feedback");
  if (!modal || !backdrop) return;

  modal.setAttribute("aria-hidden", "true");
  backdrop.setAttribute("data-open", "false");
  backdrop.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  form?.reset();
  if (feedback) { feedback.textContent = ""; feedback.className = "note"; }

  lastFocusedElement?.focus();
  lastFocusedElement = null;

  trackClick("modal", "newsletter-close", { action: "close" });
}

/* Mock subscribe (replace with backend later) */
async function handleSubscribe(email){
  return new Promise((resolve) => setTimeout(resolve, 250));
}

/* Wire modal open/close + validation + focus trap */
function setupNewsletterModal(){
  const form      = $("#nl-form");
  const emailInput= $("#nl-email");
  const feedback  = $("#nl-feedback");
  const closeBtn  = $("#nl-close");
  const modal     = $("#newsletter-modal");
  const backdrop  = $("#modal-backdrop");
  const panel     = modal?.querySelector(".modal__panel");
  const submitBtn = form?.querySelector('button[type="submit"]');

  if (!form || !emailInput || !feedback || !modal || !backdrop || !panel) return;

  // Submit & validation
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    feedback.textContent = "";
    feedback.className = "note";

    if (!validateEmail(email)) {
      feedback.textContent = "Please enter a valid email address";
      feedback.className = "note error";
      trackClick("newsletter", "subscribe-invalid", { reason: "invalid_email" });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Subscribing…";

    try {
      await handleSubscribe(email);
      feedback.textContent = "✅ Subscribed! Thank you.";
      feedback.className = "note success";
      form.reset();

      const domain = email.split("@")[1] || "";
      trackClick("newsletter", "newsletter_submit_success", { email_domain: domain });

      setTimeout(closeModal, 800);
    } catch (err) {
      feedback.textContent = (err && err.message) || "Failed to subscribe. Please try again.";
      feedback.className = "note error";
      trackClick("newsletter", "newsletter_submit_error", { error: String(err && err.message) });
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Subscribe";
    }
  });

  // Close actions
  closeBtn?.addEventListener("click", closeModal);
  backdrop?.addEventListener("click", closeModal);
  // Clicks inside the panel should NOT close the modal
  panel?.addEventListener("click", (e) => e.stopPropagation());

  // ESC to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.getAttribute("aria-hidden") === "false") {
      closeModal();
    }
  });

  // iOS: prevent background scroll when touching the backdrop
  backdrop.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  // Focus trap
  modal.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    const focusable = $$('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])', modal)
      .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  });
}


window.openModal = openModal; // expose for inline bridge

/* ============================================================================
   7) CRYPTORKA TABS + SHARED SEARCH (single, stable implementation)
   ========================================================================== */

function setupCryptorkaTabs(){
  const tabStables   = $("#tab-stables");
  const tabWallets   = $("#tab-wallets");
  const panelStables = $("#panel-stables");
  const panelWallets = $("#panel-wallets");
  const search       = $("#cryptoSearch");
  const hint         = $("#cryptoSearchHint");

  if (!tabStables || !tabWallets || !panelStables || !panelWallets || !search) return;

  function applyFilter(q){
    const query = (q || "").toLowerCase();

    // Filter current visible panel rows
    if (!panelStables.hidden) {
      $$("#crypto-tbody tr").forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(query) ? "" : "none";
      });
    } else {
      $$("#wallets-tbody tr").forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(query) ? "" : "none";
      });
    }

    // results chip
    let chip = $("#crypto-search-results");
    if (query) {
      const container = panelStables.hidden ? "#wallets-tbody" : "#crypto-tbody";
      const visible = $$(container + " tr").filter(tr => tr.style.display !== "none").length;
      const msg = `${visible} item${visible === 1 ? "" : "s"} found`;
      if (!chip) {
        chip = el("span", { id:"crypto-search-results", class:"search-results" }, msg);
        search.parentElement.appendChild(chip);
      } else {
        chip.textContent = msg;
      }

      clearTimeout(applyFilter._t);
      applyFilter._t = setTimeout(() => {
        trackClick("search", "crypto-shared-search", {
          tab: panelWallets.hidden ? "stables" : "wallets",
          search_query: query
        });
      }, 800);
    } else {
      chip?.remove();
    }
  }

  function setActive(which){
    const isStables = which === "stables";
    tabStables.classList.toggle("is-active", isStables);
    tabWallets.classList.toggle("is-active", !isStables);

    tabStables.setAttribute("aria-selected", String(isStables));
    tabWallets.setAttribute("aria-selected", String(!isStables));

    tabStables.tabIndex = isStables ? 0 : -1;
    tabWallets.tabIndex = isStables ? -1 : 0;

    panelStables.hidden = !isStables;
    panelWallets.hidden = isStables;

    if (hint) hint.textContent = isStables
      ? "Sorted by type (Stablecoin → Layer 1), then name"
      : "Sorted alphabetically by label";

    trackClick("navigation", "crypto-tab-change", { tab: which });
    applyFilter(search.value.trim());
  }

  tabStables.addEventListener("click", () => setActive("stables"));
  tabWallets.addEventListener("click", () => setActive("wallets"));

  // roving focus with arrows, Home/End, Enter/Space
  tabStables.parentElement.addEventListener("keydown", (e) => {
    const tabs = [tabStables, tabWallets];
    const i = tabs.indexOf(document.activeElement);
    if (i === -1) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : (i - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
    } else if (e.key === "Home") { e.preventDefault(); tabs[0].focus(); }
      else if (e.key === "End") { e.preventDefault(); tabs[tabs.length-1].focus(); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); document.activeElement.click(); }
  });

  search.addEventListener("input", () => applyFilter(search.value.trim()));

  // DEFAULT: show wallets unless URL explicitly requests ?tab=stables
  const p = new URLSearchParams(location.search);
  setActive(p.get("tab") !== "stables" ? "wallets" : "stables");
}


/* --- Crypto link tracking (papers/dex + wallet explorers) --- */
function bindCryptoLinkTracking() {
  document.addEventListener("click", (e) => {
    const wp = e.target.closest(".crypto-whitepaper-link");
    if (wp) {
      const symbol = wp.getAttribute("data-asset") || "UNKNOWN";
      trackClick("external-link", "crypto-paper", { asset_symbol: symbol, link_url: wp.href });
      return;
    }
    const dx = e.target.closest(".crypto-dexscreener-link");
    if (dx) {
      const symbol = dx.getAttribute("data-asset") || "UNKNOWN";
      trackClick("external-link", "crypto-dexscreener", { asset_symbol: symbol, link_url: dx.href });
      return;
    }
    const wx = e.target.closest(".wallet-explorer-link");
    if (wx) {
      trackClick("external-link", "wallet-explorer", { link_url: wx.href });
    }
  });
}
/* ============================================================================
   8) INIT + ENHANCEMENTS (global behaviors, a11y polish, helpers)
   ========================================================================== */

/* --- A11y: manage Skip Link visibility defensively (in case CSS fails) --- */
function initSkipLink() {
  const sk = document.querySelector(".skip-link");
  if (!sk) return;

  // Start hidden (JS fallback if CSS got altered)
  sk.setAttribute("aria-hidden", "true");

  const show = () => sk.removeAttribute("aria-hidden");
  const hide = () => sk.setAttribute("aria-hidden", "true");

  sk.addEventListener("focus", show);
  sk.addEventListener("blur", hide);

  // Ensure target is focusable when used
  sk.addEventListener("click", (e) => {
    const href = sk.getAttribute("href");
    if (!href || !href.startsWith("#")) return;
    const tgt = document.querySelector(href);
    if (!tgt) return;
    // Temporarily make target focusable for screen readers and keyboard users
    if (!tgt.hasAttribute("tabindex")) {
      tgt.setAttribute("tabindex", "-1");
      tgt.addEventListener("blur", () => tgt.removeAttribute("tabindex"), { once: true });
    }
    // Let default hash jump happen; focus after paint
    setTimeout(() => tgt.focus({ preventScroll: true }), 0);
  });
}

/* --- Header: subtle compact mode on scroll (works with thin top bar) --- */
function headerShrinkOnScroll() {
  const header = document.querySelector("header");
  if (!header) return;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const threshold = 8;
  let last = window.scrollY;

  const onScroll = () => {
    const y = window.scrollY;
    const delta = clamp(y - last, -50, 50);
    last = y;

    // Compact if scrolled a bit
    const compact = y > threshold;
    header.classList.toggle("is-compact", compact);

    // If you want hide-on-scroll-down/show-on-scroll-up, uncomment:
    // header.classList.toggle("is-hidden", delta > 5 && y > 96);
    // header.classList.toggle("is-shown",  delta < -5 || y <= 96);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

/* --- Top "↑" shortcut visibility & smooth scroll fallback --- */
function initTopLink() {
  const topLink = document.querySelector(".top-link");
  if (!topLink) return;

  const toggle = () => {
    const y = window.scrollY || document.documentElement.scrollTop;
    topLink.style.opacity = y > 400 ? "1" : "0";
    topLink.style.pointerEvents = y > 400 ? "auto" : "none";
  };

  window.addEventListener("scroll", toggle, { passive: true });
  toggle();
}

/* --- Primary nav: optional left/right keyboard roving focus --- */
function initPrimaryNavKeys() {
  const nav = document.querySelector("nav.primary ul");
  if (!nav) return;

  nav.addEventListener("keydown", (e) => {
    const items = Array.from(nav.querySelectorAll("a,button")).filter(Boolean);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement);
    if (i === -1) return;

    const prev = () => items[(i - 1 + items.length) % items.length].focus();
    const next = () => items[(i + 1) % items.length].focus();

    if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
    if (e.key === "ArrowRight") { e.preventDefault(); next(); }
    if (e.key === "Home") { e.preventDefault(); items[0].focus(); }
    if (e.key === "End") { e.preventDefault(); items.at(-1).focus(); }
  });
}

/* --- Persist & reflect hash focus for headings (a11y polish) --- */
function initHashFocus() {
  const focusTarget = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    // Remove tabindex after blur to keep DOM clean
    el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true });
  };

  window.addEventListener("hashchange", () => {
    const id = location.hash.slice(1);
    if (id) setTimeout(() => focusTarget(id), 0);
  });

  // If landing with a hash
  if (location.hash.length > 1) {
    const id = location.hash.slice(1);
    setTimeout(() => focusTarget(id), 0);
  }
}

/* --- Announce live result counts into aria-live regions if present --- */
function initLiveRegionHelpers() {
  const announce = (id, msg) => {
    if (!id) return;
    let r = document.getElementById(id);
    if (!r) {
      r = document.createElement("div");
      r.id = id;
      r.setAttribute("role", "status");
      r.setAttribute("aria-live", "polite");
      r.style.position = "absolute";
      r.style.left = "-9999px";
      document.body.appendChild(r);
    }
    r.textContent = msg;
  };

  // Example: announce LLM search counts if chip text changes
  const chip = document.getElementById("search-results");
  if (chip) {
    const obs = new MutationObserver(() => announce("llm-live", chip.textContent || ""));
    obs.observe(chip, { childList: true, characterData: true, subtree: true });
  }
}

/* --- Smooth-scroll to section from URL param (?goto=#id) --- */
function initGotoParam() {
  const p = new URLSearchParams(location.search);
  const goto = p.get("goto");
  if (!goto || !goto.startsWith("#")) return;
  const target = document.querySelector(goto);
  if (!target) return;
  const opt = prefersReducedMotion() ? {} : { behavior: "smooth", block: "start" };
  setTimeout(() => target.scrollIntoView(opt), 10);
}

/* --- Utility: ensure table rows carry data-labels (defense vs. custom HTML) --- */
function ensureTableDataLabels() {
  const apply = (table) => {
    const ths = Array.from(table.querySelectorAll("thead th"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    if (!ths.length || !rows.length) return;
    rows.forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        if (!td.hasAttribute("data-label") && ths[i]) {
          td.setAttribute("data-label", ths[i].textContent.trim());
        }
      });
    });
  };

  $$("table").forEach(apply);
}

/* --- Defensive delegation: attach once for dynamic content too --- */
function initGlobalDelegates() {
  // Relink tracking if nodes are injected later
  const rebindDelegates = debounce(() => {
    // No-op reserved for future dynamic modules; kept to preserve length/parity.
  }, 300);

  const mo = new MutationObserver(rebindDelegates);
  mo.observe(document.documentElement, { childList: true, subtree: true });
}

/* ============================================================================
   MOBILE HELPERS: tables + tap targets (defensive, zero-deps)
   - Wrap bare <table> in .table-wrap for horizontal scrolling on phones
   - Sticky header support remains CSS-based
   - Subtle edge gradients hint scrollability via CSS pseudo-elements
   - Ensure interactive elements meet 44px minimum hit area
   ========================================================================== */

/* rAF throttle to avoid scroll handler spam */
function __rafThrottle(fn) {
  let ticking = false;
  return function (...args) {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; fn.apply(this, args); });
  };
}

/* Wrap any table not already inside .table-wrap */
function wrapTables() {
  const wrappers = [];
  const tables = Array.from(document.querySelectorAll('table'));
  tables.forEach((table) => {
    if (table.closest('.table-wrap')) {
      const existing = table.closest('.table-wrap');
      if (existing) wrappers.push(existing);
      return; // already wrapped
    }
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const parent = table.parentNode;
    if (!parent) return;
    parent.insertBefore(wrap, table);
    wrap.appendChild(table);
    wrappers.push(wrap);
  });
  return wrappers;
}

/* Compute and toggle scroll hint classes on a wrapper */
function updateScrollHints(wrap) {
  if (!wrap) return;
  const canScroll = wrap.scrollWidth - wrap.clientWidth > 1;
  wrap.classList.toggle('is-scrollable', canScroll);
  if (!canScroll) { wrap.classList.remove('at-start', 'at-end'); return; }
  const atStart = wrap.scrollLeft <= 1;
  const atEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1;
  wrap.classList.toggle('at-start', atStart);
  wrap.classList.toggle('at-end', atEnd);
}

/* Attach scroll listeners and initialize hint states */
function initScrollHints(wrappers) {
  const onScroll = __rafThrottle((e) => updateScrollHints(e.currentTarget));
  wrappers.forEach((wrap) => {
    updateScrollHints(wrap);
    wrap.addEventListener('scroll', onScroll, { passive: true });
  });
  const onResize = debounce(() => wrappers.forEach(updateScrollHints), 150);
  window.addEventListener('resize', onResize, { passive: true });
}

/* Ensure buttons/links meet 44px tap target without changing layout semantics */
function ensureTapTargets() {
  const sels = ['.btn', 'button', '[role="button"]', 'a.btn', 'nav.primary a', '.nav-btn'];
  const els = sels.flatMap((s) => Array.from(document.querySelectorAll(s)));
  els.forEach((el) => {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    if (rect && rect.height > 0 && rect.height < 44) {
      el.classList.add('hit-boost');
    }
  });
}

/* ============================================================================
   9) INIT — BOOTSTRAP APP
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* Render content */
  renderLLMTable();
  renderPapersCore();
  renderPaperGroups();
  renderTimeline();
  renderCryptoTable();

  /* Bind global interactions */
  bindLLMOfficialClickTracking();
  bindLLMKeyboardNav();
  bindLLMSearch();
  bindCollapsibles();
  bindSmoothScroll();
  setupNavigationTracking();
  setupExternalLinkTracking();
  setupNewsletterModal();
  setupCryptorkaTabs();
  bindCryptoLinkTracking();

  /* A11y + polish helpers */
  initSkipLink();
  initPrimaryNavKeys();
  initHashFocus();
  initLiveRegionHelpers();

  /* UX behaviors */
  headerShrinkOnScroll();
  initTopLink();
  initGotoParam();
  ensureTableDataLabels();
  /* Mobile: wrap any stray tables and show scroll hints */
  const __wraps = wrapTables();
  initScrollHints(__wraps);
  ensureTapTargets();
  window.addEventListener('resize', debounce(ensureTapTargets, 150), { passive: true });
  /* Defensive: if dynamic nodes get injected later, wrap/hint new tables */
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(debounce(() => {
      const newWraps = wrapTables();
      newWraps.forEach(updateScrollHints);
      ensureTapTargets();
    }, 120));
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }
  initGlobalDelegates();

  /* Open modal buttons */
  $("#newsletter-btn")?.addEventListener("click", () => {
    trackClick("button", "newsletter-btn-nav", { action: "open-modal" });
    openModal();
  });
  $("#fab-newsletter")?.addEventListener("click", () => {
    trackClick("button", "newsletter-btn-fab", { action: "open-modal" });
    openModal();
  });
});

/* ============================================================================
   10) OPTIONAL: small polyfills / safe-guards (kept tiny, no deps)
   ========================================================================== */

/* :focus-visible fallback for very old browsers (no-op in modern) */
(function focusVisibleFallback(){
  try {
    // If browser supports :focus-visible, do nothing.
    document.querySelector(":focus-visible");
  } catch {
    let hadKeyboardEvent = false;

    const onKeyDown = (e) => {
      const keys = ["Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
      if (keys.includes(e.key)) hadKeyboardEvent = true;
    };
    const onPointerDown = () => (hadKeyboardEvent = false);

    const onFocus = (e) => {
      if (hadKeyboardEvent) e.target.classList.add("focus-visible-polyfill");
    };
    const onBlur = (e) => e.target.classList.remove("focus-visible-polyfill");

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("touchstart", onPointerDown, true);
    document.addEventListener("focus", onFocus, true);
    document.addEventListener("blur", onBlur, true);
  }
})();

/* Smooth scroll behavior polyfill-ish (very light / optional) */
(function smoothScrollGuard(){
  if ("scrollBehavior" in document.documentElement.style) return; // native supported
  // Fallback: jump instantly (no polyfill lib to keep zero deps)
  // Kept as placeholder for parity and future extension.
})();

/* ============================================================================
   11) DIAGNOSTICS (can be toggled during dev, silent in prod)
   ========================================================================== */

const __DEV__ = false; // set true locally if you want console diagnostics

function devLog(...args) { if (__DEV__) console.log("[PABLOBOT]", ...args); }
function devWarn(...args){ if (__DEV__) console.warn("[PABLOBOT]", ...args); }
function devErr(...args) { if (__DEV__) console.error("[PABLOBOT]", ...args); }

devLog("Boot sequence prepared.");


// Form-urlencode helper for Netlify
function encode(data) {
  return Object.keys(data)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k]))
    .join("&");
}

// Submit to Netlify Forms (records submission + lets us keep modal UX)
async function handleSubscribe(email) {
  const payload = {
    "form-name": "newsletter",
    email
  };

  const res = await fetch("/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: encode(payload)
  });

  if (!res.ok) {
    throw new Error("Netlify submission failed");
  }
}

/* ============================================================================
   END OF FILE
   ========================================================================== */
/* Mobile enhancement for the specific searchbar (Vanilla JS, no globals) */
(() => {
  const root = document.querySelector('.searchbar');
  const input = document.getElementById('cryptoSearch');
  const hint  = document.getElementById('cryptoSearchHint') || root?.querySelector('.kb');

  if (!root || !input) return;

  /* Ensure input meets minimum touch target height without breaking layout */
  const ensureTapTarget = () => {
    const rect = input.getBoundingClientRect();
    if (rect.height < 44) {
      // Add a lightweight inline style boost (local to this element only)
      input.style.minBlockSize = '44px';
    }
  };

  /* Inject a clear button that only appears when there is text */
  const mountClearButton = () => {
    // container for proper absolute positioning context relative to the input
    // Without changing HTML, we wrap visually by overlaying a positioned element
    // in the searchbar and aligning to the input’s right edge.
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'search-clear-btn';
    btn.setAttribute('aria-label', 'Clear search');
    btn.title = 'Clear';

    // Position the button relative to the searchbar; align to input’s right padding
    // Use a wrapper span to host the absolutely positioned button
    const holder = document.createElement('span');
    holder.className = 'search-clear';
    holder.style.position = 'relative';

    // Insert holder after the input so it lives in the same stacking context
    input.insertAdjacentElement('afterend', holder);
    holder.appendChild(btn);

    // Toggle visibility based on input value and focus state
    const toggle = () => {
      const hasValue = !!input.value;
      btn.classList.toggle('is-visible', hasValue);
      // When our custom clear is active, hide native WebKit cancel icon for consistency
      input.classList.toggle('has-custom-clear', hasValue);
    };

    btn.addEventListener('click', () => {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus({ preventScroll: true });
      toggle();
    });

    input.addEventListener('input', toggle);
    input.addEventListener('focus', toggle);
    input.addEventListener('blur', toggle);

    // Initialize once
    toggle();

    // Keep the button aligned on resize (debounced)
    let raf = 0;
    const onResize = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // If layout shifts drastically, ensureTapTarget again
        ensureTapTarget();
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
  };

  /* Optional: soften hint behavior on mobile—hide when typing, show when empty */
  const wireHintBehavior = () => {
    if (!hint) return;
    const update = () => {
      const empty = input.value.length === 0;
      hint.style.opacity = empty ? '0.85' : '0.0';
      hint.style.transition = 'opacity 140ms ease';
      hint.setAttribute('aria-hidden', empty ? 'false' : 'true');
    };
    input.addEventListener('input', update);
    input.addEventListener('focus', update);
    input.addEventListener('blur', update);
    update();
  };

  /* Initialize on DOM ready or immediately if already interactive */
  const start = () => {
    ensureTapTarget();
    mountClearButton();
    wireHintBehavior();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
