"use strict";

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
    },
    {
      title: "AI History Milestones",
      items: [
        { t: "Turing (1950): Computing Machinery and Intelligence (Turing Test)", url: "https://en.wikipedia.org/wiki/Turing_test", note: "Defines the Imitation Game." },
        { t: "Turing (1936): On Computable Numbers (Halting Problem)", url: "https://www.cs.ox.ac.uk/activities/ieg/e-library/sources/tp2-ie.pdf", note: "Introduces Turing machines and undecidability." },
        { t: "McCulloch & Pitts (1943)", url: "https://en.wikipedia.org/wiki/Artificial_neuron#McCulloch%E2%80%93Pitts_neuron", note: "Formal neuron model for computation." },
        { t: "Logic Theorist (1956)", url: "https://en.wikipedia.org/wiki/Logic_Theorist", note: "Early AI program proving theorems." },
        { t: "Rosenblatt (1958): Perceptron", url: "https://en.wikipedia.org/wiki/Perceptron", note: "Foundational linear classifier / neural net." },
        { t: "Weizenbaum (1966): ELIZA", url: "https://dl.acm.org/doi/10.1145/365153.365168", note: "Early NLP chatbot demonstrating conversation." },
        { t: "Deep Blue (1997)", url: "https://www.research.ibm.com/articles/deep-blue", note: "IBM chess system defeats Kasparov." },
        { t: "Watson/DeepQA (2011)", url: "https://dl.acm.org/doi/10.1145/2001186.2001189", note: "IBM Watson Jeopardy! system overview." },
        { t: "AlexNet (2012)", url: "https://proceedings.neurips.cc/paper_files/paper/2012/file/c399862d3b9d6b76c8436e924a68c45b-Paper.pdf", note: "ImageNet CNN breakthrough." },
        { t: "AlphaGo (2016)", url: "https://www.nature.com/articles/nature16961", note: "Deep nets + MCTS master Go." }
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

  // Merge the last two groups into a compact "Other" card (links only)
  let groups = DATA.paperGroups.slice();
  if (groups.length >= 4) {
    const g3 = groups[2];
    const g4 = groups[3];
    const mergedItems = [];
    if (g3 && Array.isArray(g3.items)) mergedItems.push(...g3.items.map(({ t, url }) => ({ t, url })));
    if (g4 && Array.isArray(g4.items)) mergedItems.push(...g4.items.map(({ t, url }) => ({ t, url })));
    groups = [groups[0], groups[1], { title: "📜Other", items: mergedItems }];
  }

  for (const group of groups) {
    const normTitle = String(group.title || "").toLowerCase().replace(/^[^a-z]+/,'');
    const isOther = (normTitle === "other");
    const list = el("ul", { class: isOther ? "list list--compact" : "list" });
    for (const { t, url, note } of group.items) {
      const a = el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, t);
      if (isOther) {
        list.appendChild(el("li", {}, a));
      } else {
        list.appendChild(el("li", {}, el("strong", {}, a), ` — ${note}`));
      }
    }
    root.appendChild(el("div", { class: isOther ? "card card--compact" : "card" }, el("h3", {}, group.title), list));
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
  // Build UL list directly from data
  const ranked = rankCryptos(CRYPTOS);
  const list = $("#crypto-list");
  if (list) {
    list.innerHTML = "";
    for (const c of ranked) {
      const li = document.createElement('li');
      const row = document.createElement('div'); row.className = 'crypto-row';
      const emoji = document.createElement('span'); emoji.className='emoji'; emoji.textContent = c.emoji || '💰';
      const title = document.createElement('strong'); title.textContent = `${c.name} (${c.symbol})`;
      row.appendChild(emoji); row.appendChild(title);
      const meta = document.createElement('div'); meta.className='crypto-meta'; meta.textContent = `${c.type || ''} • ${c.network || ''}`;
      const links = document.createElement('div'); links.className='crypto-links';
      const a1 = document.createElement('a'); a1.href=c.paper; a1.target='_blank'; a1.rel='noopener'; a1.className='crypto-whitepaper-link'; a1.setAttribute('data-asset', c.symbol); a1.textContent='Paper';
      const a2 = document.createElement('a'); a2.href=c.dexscreener; a2.target='_blank'; a2.rel='noopener'; a2.className='crypto-dexscreener-link'; a2.setAttribute('data-asset', c.symbol); a2.textContent='Pairs';
      links.appendChild(a1); links.appendChild(a2);
      li.appendChild(row); li.appendChild(meta); li.appendChild(links);
      list.appendChild(li);
    }
    list.hidden = false;
  }
}

// Build wallets mobile list from existing table rows
const WALLETS = [
  { label: 'Hermes',   network: 'Solana',   emoji: '🪽', explorer: 'https://solscan.io/account/benRLpbWCL8P8t51ufYt522419hGF5zif3CqgWGbEUm' },
  { label: 'Vulcan',   network: 'Solana',   emoji: '🔥', explorer: 'https://solscan.io/account/8L8qZp9KGSCYNYChYCNJ8NNkB296r2U7N9d9JcLmYRuG' },
  { label: 'Poseidon', network: 'Solana',   emoji: '🔱', explorer: 'https://solscan.io/account/G5nxEXuFMfV74DSnsrSatqCW32F34XUnBeq3PfDS7w5E' },
  { label: 'Zeus',     network: 'Ethereum', emoji: '⚡', explorer: 'https://etherscan.io/address/0xA7F3659c53820346176f7E0E350780DF304db179' },
  { label: 'Hera',     network: 'Ethereum', emoji: '👑', explorer: 'https://etherscan.io/address/0xFB3BF33Ba8E5d08D87B0db0e46952144DF822833' }
];

function renderWalletsList(){
  const list = document.querySelector('#wallets-list');
  if (!list) return;
  list.innerHTML = '';
  WALLETS.forEach(w => {
    const li = document.createElement('li');
    const row = document.createElement('div'); row.className = 'crypto-row';
    const emoji = document.createElement('span'); emoji.className = 'emoji'; emoji.textContent = w.emoji || '🐋';
    const title = document.createElement('strong'); title.textContent = w.label;
    row.appendChild(emoji); row.appendChild(title);
    const meta = document.createElement('div'); meta.className='crypto-meta'; meta.textContent = w.network || '';
    const links = document.createElement('div'); links.className='crypto-links';
    if (w.explorer) {
      const a = document.createElement('a'); a.href = w.explorer; a.target='_blank'; a.rel='noopener'; a.textContent='Explorer'; a.className='wallet-explorer-link';
      links.appendChild(a);
    }
    li.appendChild(row); li.appendChild(meta); li.appendChild(links);
    list.appendChild(li);
  });
  list.hidden = false;
}

/* ============================================================================
   4A) PROMPT CAROUSEL (mobile-first, scroll-snap)
   - Renders enriched cards with emoji, stats, tags, and actions
   ========================================================================== */

/* (removed) PROMPTS for carousel */
/* const PROMPTS = [
  {
    rank: 1,
    emojis: "🛰️💬🧵",
    title: "Long-context executive distill",
    blurb: "Boil a 100K-token transcript into decisions, owners, dates, risks.",
    prompt: `Act as a Chief of Staff. Input: a very long meeting transcript.
Output strictly as:
1) A compact table (UTF-8) of 10 key decisions with {Decision, Rationale (≤12 words), Owner, Deadline (YYYY-MM-DD), Dependencies}.
2) A 200-word executive brief (≤5 sentences, active voice).
3) A bullet list of 5 unresolved risks, each with Mitigation (≤15 words) and Trigger (measurable).
Rules:
- Infer dates only if explicitly stated; otherwise write "TBD".
- Merge duplicates; remove chatter.
- No quotes, no speculation, no filler.
- Keep total output ≤ 350 words excluding the table.`,
    tags: ["long-context","ops","summary"],
    link: "https://x.ai/"
  },
  {
    rank: 2,
    emojis: "🧠⚙️📈",
    title: "Reasoning—finals only",
    blurb: "Solve multi-step logic without exposing inner steps.",
    prompt: `Solve the multi-step math/logic problem.
Think privately; DO NOT reveal intermediate steps.
Return exactly:
• Final answer (on its own line)
• Verification: 2 sentences that check key constraints without steps
• If uncertainty remains: list the minimal extra data needed as 1–3 bullets; otherwise write "None".
No other text, no chain-of-thought.`,
    tags: ["reasoning","math"],
    link: "https://api.deepseek.com/"
  },
  {
    rank: 3,
    emojis: "🦙🧰🌐",
    title: "Llama mini-RAG blueprint",
    blurb: "Sketch a pragmatic RAG with chunks, indexes, retrieval, rerank, evals.",
    prompt: `Design a lightweight RAG for mixed PDFs + web pages.
Deliverables:
A) Architecture (bullets): ingest, chunking, embedding dims, index type, retrieval, rerank.
B) Pseudocode snippets for: (1) ingestion & chunking, (2) indexing, (3) query → retrieve → rerank → answer.
C) Evaluation plan: metrics (Precision@k, Recall@k, NDCG@k), dataset sketch, and pass thresholds.
Constraints:
- Chunking per type: PDF, code, HTML; justify overlap sizes.
- Keep pseudocode language-agnostic; show function signatures and comments.
- Include an ablation you would run first (1 paragraph).`,
    tags: ["RAG","design"],
    link: "https://ai.meta.com/llama/"
  },
  {
    rank: 4,
    emojis: "⚡️⌛️🧪",
    title: "Dual-route latency planner",
    blurb: "Specify FAST (<300ms) vs THOROUGH routes with trade-offs.",
    prompt: `Propose two execution routes for the task:
FAST:
- Model, temperature, max_tokens, stop, expected latency (<300ms), expected failure modes, when to use.
THOROUGH:
- Model, temperature, max_tokens, stop, rerank/verification step, expected latency, quality wins, when to use.
Then add:
- Auto-router heuristic: 5 crisp rules for choosing the route.
- Guardrails: 3 checks to cap token growth & prevent long tails.`,
    tags: ["systems","routing"],
    link: "#"
  },
  {
    rank: 5,
    emojis: "🧩🧪🔒",
    title: "Adversarial safety battery",
    blurb: "Six red-team cases with threat models & pass/fail.",
    prompt: `Produce 6 adversarial test cases that attempt jailbreaks while remaining within policy.
For each case include:
- Threat model (vector, user intent, model weakness targeted)
- Prompt (1–2 lines)
- Expected safe behavior
- Pass/Fail criteria (observable, binary)
Cover categories: obfuscation, roleplay, multi-turn escalation, multilingual pivot, code execution lure, and ambiguous medical/legal advice.
No disallowed content in examples.`,
    tags: ["safety","evals"],
    link: "#"
  },
  {
    rank: 6,
    emojis: "🗺️🌍🗣️",
    title: "Tri-locale launch brief",
    blurb: "Localize to EN-US, ZH-CN, ES-MX + tone guide.",
    prompt: `Rewrite the announcement for:
1) United States (EN-US),
2) Mainland China (ZH-CN, Simplified),
3) Mexico (ES-MX).
Keep meaning; localize idioms, units, holidays, and formality.
Deliver:
- Tone guide table per locale: {Formality, Energy, Key idioms, Taboo topics to avoid, CTA style}.
- Three localized versions (≤150 words each), each with a 10-word headline and a 1-line CTA.
- Note any claims that need re-verification for each locale.`,
    tags: ["i18n","localization"],
    link: "#"
  },
  {
    rank: 7,
    emojis: "🧑‍💻📦🧪",
    title: "Refactor + test harness",
    blurb: "Clean code, document, and add table-driven tests.",
    prompt: `Given the function, produce:
A) Refactored code: readable, O(Big-O) unchanged or better, pure where possible, clear names.
B) Docstring: purpose, params, returns, errors, examples.
C) Edge cases handled explicitly (list).
D) Table-driven unit tests (incl. pathological inputs and property-like checks).
E) Comment complex lines with intent (why, not what).
Return only code blocks for A and D, and brief bullets for B/C/E.`,
    tags: ["code","testing"],
    link: "#"
  },
  {
    rank: 8,
    emojis: "📚🧪📊",
    title: "Balanced eval set for QA",
    blurb: "50 items × 5 tiers × 3 domains with rubrics.",
    prompt: `Generate 50 QA items across 3 domains (e.g., product, data, reasoning) and 5 difficulty tiers (1=trivial…5=expert).
For each item include:
- task_type, domain, difficulty(1–5), prompt, expected_answer, rubric (3–5 bullet criteria), pitfalls (2 bullets).
Balance:
- ~16/17 items per domain; 10 per difficulty evenly distributed (allow ±1).
- Include 20% adversarial/edge cases.
Deliver as a compact UTF-8 table plus a JSON export array.`,
    tags: ["evals","synthetic"],
    link: "#"
  },
  {
    rank: 9,
    emojis: "🔍🧭📑",
    title: "Policy QA navigator",
    blurb: "Answer under policy with cited sections.",
    prompt: `Given a policy document with section IDs, answer user queries.
If the query conflicts with policy: decline and propose a safe alternative.
Always cite sections as [§ID] adjacent to the relevant sentence.
Output:
1) Answer or Decline (2–5 sentences, precise)
2) Cited sections (list)
3) Rationale (1–2 sentences)
No extra commentary.`,
    tags: ["policy","guardrails"],
    link: "#"
  },
  {
    rank: 10,
    emojis: "🧾✍️🎯",
    title: "One-page PRD distiller",
    blurb: "Turn messy notes into a crisp PRD (≤600 words).",
    prompt: `From notes, create a one-pager PRD with headings:
- Problem
- Goals (SMART, 3–5 bullets)
- Non-Goals (3–5 bullets)
- Users & JTBD (2 personas, 2 scenarios each)
- Requirements (Must/Should/Could with acceptance tests)
- Risks (top 3 with mitigations)
- Success Metrics (north star + 3 leading)
Hard cap 600 words. Use short sentences. No fluff.`,
    tags: ["pm","docs"],
    link: "#"
  },
  {
    rank: 11,
    emojis: "📈🗂️🔎",
    title: "Prose→ANSI SQL + self-check",
    blurb: "Translate a question to SQL and add a validator query.",
    prompt: `Input: schema + plain-English question.
Output:
1) Main ANSI SQL query solving the task.
2) A second SQL query that validates the first via row-counts, ranges, or consistency checks.
3) One sentence on assumptions; if any table/column is missing, state "Assumption: …".
No explanatory prose beyond the above.`,
    tags: ["data","sql"],
    link: "#"
  },
  {
    rank: 12,
    emojis: "🧠🕵️‍♀️🧪",
    title: "Hallucination label & rewrite",
    blurb: "Tag FACT/UNSUPPORTED/SPECULATIVE, then purge fluff.",
    prompt: `Given an answer, label each sentence as:
- FACT (include source or citation tag),
- UNSUPPORTED,
- SPECULATIVE.
Then provide a revised version containing only verified FACT content.
Format:
1) Labeled list (one line per sentence)
2) Revised answer (≤150 words)`,
    tags: ["quality","audit"],
    link: "#"
  },
  {
    rank: 13,
    emojis: "🎭🗣️✨",
    title: "Brand voice mimicry kit",
    blurb: "Infer voice from 3 samples; output guide + rewrite.",
    prompt: `From 3 brand samples:
A) Create a style guide with: Tone, Syntax patterns, Signature phrases, Do/Don't lexicon, Sentence length, Pacing, Imagery level.
B) Rewrite the new copy in that voice (≤120 words).
C) Provide a 5-item checklist to QA future content for fit.
Avoid verbatim reuse unless required by trademarks.`,
    tags: ["marketing","style"],
    link: "#"
  },
  {
    rank: 14,
    emojis: "🧱🔗📦",
    title: "Chunking strategy picker",
    blurb: "Pick chunk sizes/overlap per doc type with heuristics.",
    prompt: `For document types {PDF, code, HTML}, recommend:
- Chunk sizes & overlaps
- Section-aware splitting rules
- Heuristics (e.g., heading depth, table detection, code blocks)
- Trade-offs (recall vs precision) and when to rerank
Then propose a small experiment matrix (3 configs) and the metric you’d choose to ship.
Be concrete and justify choices.`,
    tags: ["RAG","chunking"],
    link: "#"
  },
  {
    rank: 15,
    emojis: "🧭🧯🧑‍⚖️",
    title: "Cross-functional risk review",
    blurb: "Top 7 Legal/Privacy/Brand risks with owners & mitigations.",
    prompt: `From the plan, list the top 7 risks spanning Legal, Privacy, and Brand (at least 2 per area).
For each: Title, Area, Severity(1–5), Likelihood(1–5), Owner, Mitigation (≤12 words), Early-warning signal, Residual risk.
End with a 3-line summary: what to monitor, decision needed, and date of next review.`,
    tags: ["risk","review"],
    link: "#"
  }
]; */

/* function renderPromptCarousel(){
  const root = document.getElementById("prompt-carousel");
  if (!root) return;

  root.innerHTML = "";

  const viewport = el("div", { class: "carousel__viewport", role: "region", "aria-roledescription": "carousel", "aria-label": "Prompt Templates" });
  const track = el("div", { class: "carousel__track" });
  viewport.appendChild(track);

  const controls = el("div", { class: "carousel__controls" },
    el("button", { class: "carousel__btn", type: "button", "aria-label": "Previous", "data-dir": "prev" }, "‹"),
    el("button", { class: "carousel__btn", type: "button", "aria-label": "Next", "data-dir": "next" }, "›")
  );
  const dots = el("div", { class: "carousel__dots", role: "tablist", "aria-label": "Pagination" });

  // Build slides
  const n = PROMPTS.length;
  const slides = [];
  for (let i = 0; i < n; i++) {
    const p = PROMPTS[i];
    const words = String(p.prompt || "").trim().split(/\s+/).filter(Boolean).length;
    const tagCount = Array.isArray(p.tags) ? p.tags.length : 0;

    const card = el("article", { class: "card prompt-card" },
      el("div", { class: "prompt-card__head" },
        el("div", { class: "prompt-card__emoji", "aria-hidden": "true" }, p.emojis || "✨"),
        el("div", {},
          el("h3", { class: "prompt-card__title" }, p.title || "Untitled"),
          el("p", { class: "prompt-card__blurb" }, p.blurb || "")
        )
      ),
      el("div", { class: "prompt-stats" },
        el("span", { class: "stat" }, el("b", {}, `#${p.rank ?? (i + 1)}`), " rank"),
        el("span", { class: "stat" }, el("b", {}, String(tagCount)), " tags"),
        el("span", { class: "stat" }, el("b", {}, String(words)), " words")
      ),
      el("div", { class: "chips" }, ...(p.tags || []).map(t => el("span", { class: "chip" }, t))),
      el("div", { class: "prompt-card__actions" },
        el("button", { class: "btn btn--ghost", type: "button", "data-action": "copy", "data-idx": String(i) }, "Copy Prompt"),
        p.link ? el("a", { class: "btn btn--brand", href: p.link, target: "_blank", rel: "noopener", "data-action": "open", "data-idx": String(i) }, "Open") : null
      )
    );

    const slide = el("div", { class: "carousel__slide", role: "group", "aria-label": `${i + 1} of ${n}` }, card);
    track.appendChild(slide);
    slides.push(slide);
  }

  root.appendChild(viewport);
  root.appendChild(controls);
  root.appendChild(dots);

  // Helpers
  const getPositions = () => slides.map(s => s.offsetLeft);
  const getSlideIndexNear = () => {
    const x = viewport.scrollLeft;
    let best = 0, min = Infinity;
    positions.forEach((left, idx) => { const d = Math.abs(left - x); if (d < min) { min = d; best = idx; } });
    return best;
  };
  const pageSize = () => {
    const first = slides[0];
    const w = first ? first.getBoundingClientRect().width : viewport.clientWidth;
    return Math.max(1, Math.round(viewport.clientWidth / Math.max(1, w)));
  };
  const pagesCount = () => Math.ceil(slides.length / pageSize());
  const toIndex = (idx) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, idx));
    viewport.scrollTo({ left: slides[clamped].offsetLeft, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    updateDots();
  };
  const toPage = (pg) => toIndex(pg * pageSize());

  // Dots
  const buildDots = () => {
    dots.innerHTML = "";
    const pages = pagesCount();
    for (let i = 0; i < pages; i++) {
      const b = el("button", { class: "carousel__dot", type: "button", role: "tab", "aria-label": `Go to page ${i + 1}`, "data-page": String(i) });
      dots.appendChild(b);
    }
    updateDots();
  };
  const updateDots = () => {
    const currSlide = getSlideIndexNear();
    const ps = pageSize();
    const page = Math.floor(currSlide / ps);
    Array.from(dots.children).forEach((d, i) => d.setAttribute("aria-current", i === page ? "true" : "false"));
  };

  // Events
  let positions = getPositions();
  viewport.addEventListener("scroll", debounce(updateDots, 60), { passive: true });
  window.addEventListener("resize", debounce(() => { positions = getPositions(); buildDots(); updateDots(); }, 120), { passive: true });

  controls.addEventListener("click", (e) => {
    const btn = e.target.closest(".carousel__btn");
    if (!btn) return;
    const dir = btn.getAttribute("data-dir");
    const currSlide = getSlideIndexNear();
    const ps = pageSize();
    const currPage = Math.floor(currSlide / ps);
    const nextPage = dir === "prev" ? Math.max(0, currPage - 1) : Math.min(pagesCount() - 1, currPage + 1);
    toPage(nextPage);
  });

  dots.addEventListener("click", (e) => {
    const dot = e.target.closest(".carousel__dot");
    if (!dot) return;
    const p = parseInt(dot.getAttribute("data-page") || "0", 10);
    toPage(p);
  });

  // Copy / Open actions (delegated)
  root.addEventListener("click", async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const idx = parseInt(btn.getAttribute('data-idx') || '0', 10);
    const item = PROMPTS[idx];
    if (!item) return;

    if (action === 'copy') {
      try {
        await navigator.clipboard?.writeText(item.prompt || '');
        const prev = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = prev; }, 1200);
        trackClick('button', 'prompt-copy', { rank: item.rank, title: item.title });
      } catch(err) {
        alert('Copy failed. Select and copy manually.');
      }
    }
    if (action === 'open') {
      trackClick('external-link', 'prompt-open-link', { rank: item.rank, title: item.title, url: item.link || null });
    }
  });

  // Initial
  buildDots();
  updateDots();
} */

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
  const search       = $("#cryptoSearch"); // may be absent
  const hint         = $("#cryptoSearchHint");

  if (!tabStables || !tabWallets || !panelStables || !panelWallets) return;

    function applyFilter(q){
      const query = (q || "").toLowerCase();

      // Filter current visible panel rows
      if (!panelStables.hidden) {
      $$("#crypto-tbody tr").forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(query) ? "" : "none";
      });
      $$("#crypto-list li").forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(query) ? "" : "none";
      });
      } else {
      $$("#wallets-tbody tr").forEach(tr => {
        tr.style.display = tr.innerText.toLowerCase().includes(query) ? "" : "none";
      });
      $$("#wallets-list li").forEach(li => {
        li.style.display = li.innerText.toLowerCase().includes(query) ? "" : "none";
      });
      }

    // Search removed; no results chip
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

    if (hint) hint.textContent = '';

    trackClick("navigation", "crypto-tab-change", { tab: which });
    applyFilter('');
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

  // Search removed for prod simplicity

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

/* Ensure buttons/links meet ~40px tap target without changing layout semantics */
function ensureTapTargets() {
  const sels = ['.btn', 'button', '.tab', '[role="button"], a.btn', 'nav.primary a', '.nav-btn'];
  const els = sels.flatMap((s) => Array.from(document.querySelectorAll(s)));
  els.forEach((el) => {
    if (!el || !el.isConnected) return;
    const rect = el.getBoundingClientRect();
    if (rect && rect.height > 0 && rect.height < 40) {
      el.classList.add('hit-boost');
    }
  });
}

/* Ensure target="_blank" links get rel="noopener" for security */
function ensureNoopener(){
  try {
    document.querySelectorAll('a[target="_blank"]').forEach((a)=>{
      const rel = (a.getAttribute('rel')||'').toLowerCase();
      if (!/noopener/.test(rel)) a.setAttribute('rel', (rel? rel+' ' : '') + 'noopener');
    });
  } catch(_) {}
}

/* Data-attribute based scroll shadows on .table-wrap (disabled ≤560px) */
const __CARD_MODE_MQ = window.matchMedia('(max-width: 560px)');
function updateWrapShadows(wrap) {
  if (!wrap) return;
  if (__CARD_MODE_MQ.matches) {
    wrap.removeAttribute('data-shadow-left');
    wrap.removeAttribute('data-shadow-right');
    return;
  }
  const canScroll = wrap.scrollWidth - wrap.clientWidth > 1;
  if (!canScroll) {
    wrap.removeAttribute('data-shadow-left');
    wrap.removeAttribute('data-shadow-right');
    return;
  }
  const atStart = wrap.scrollLeft <= 1;
  const atEnd = wrap.scrollLeft + wrap.clientWidth >= wrap.scrollWidth - 1;
  wrap.setAttribute('data-shadow-left', String(!atStart));
  wrap.setAttribute('data-shadow-right', String(!atEnd));
}
function initWrapShadows(wrappers) {
  const onScroll = __rafThrottle((e) => updateWrapShadows(e.currentTarget));
  wrappers.forEach((wrap) => {
    updateWrapShadows(wrap);
    wrap.addEventListener('scroll', onScroll, { passive: true });
  });
  const onResize = debounce(() => wrappers.forEach(updateWrapShadows), 150);
  window.addEventListener('resize', onResize, { passive: true });
  __CARD_MODE_MQ.addEventListener?.('change', () => wrappers.forEach(updateWrapShadows));
}

/* Search clear (×) button for search inputs without changing layout height */
function initSearchClear() {
  const inputs = ['#cryptoSearch', '#llmSearch']
    .map((sel) => document.querySelector(sel))
    .filter(Boolean);
  inputs.forEach((input) => {
    const bar = input.closest('.searchbar') || input.parentElement;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Clear search');
    Object.assign(btn.style, {
      position: 'absolute', insetInlineEnd: '10px', insetBlockStart: '50%', transform: 'translateY(-50%)',
      minInlineSize: '32px', minBlockSize: '32px', border: 'none', borderRadius: '8px', background: 'transparent', cursor: 'pointer',
      display: 'none', alignItems: 'center', justifyContent: 'center', padding: '0', fontSize: '20px', lineHeight: '1', opacity: '0.6'
    });
    btn.textContent = '×';
    const toggle = () => { btn.style.display = input.value ? 'inline-flex' : 'none'; };
    btn.addEventListener('click', () => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); input.focus(); toggle(); });
    input.addEventListener('input', toggle, { passive: true });
    input.addEventListener('focus', toggle, { passive: true });
    input.addEventListener('blur', toggle, { passive: true });
    if (bar && input.nextSibling) { bar.insertBefore(btn, input.nextSibling); } else if (bar) { bar.appendChild(btn); }
    toggle();
  });
}

/* ============================================================================
   9) INIT — BOOTSTRAP APP
   ========================================================================== */

document.addEventListener("DOMContentLoaded", () => {
  /* Render content */
  // (carousel removed)
  renderLLMTable();
  renderPapersCore();
  renderPaperGroups();
  renderTimeline();
  renderCryptoTable();
  renderWalletsList();

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
  ensureNoopener();
  /* Mobile: wrap any stray tables and show scroll hints + edge fades */
  const __wraps = wrapTables();
  initScrollHints(__wraps);
  initWrapShadows(__wraps);
  ensureTapTargets();
  initSearchClear();
  window.addEventListener('resize', debounce(ensureTapTargets, 150), { passive: true });
  /* Defensive: if dynamic nodes get injected later, wrap/hint new tables */
  if ('MutationObserver' in window) {
    const mo = new MutationObserver(debounce(() => {
      const newWraps = wrapTables();
      newWraps.forEach(updateScrollHints);
      newWraps.forEach(updateWrapShadows);
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
/* Vanilla JS enhancements:
   1) Adds scroll edge-hint shadows on wider screens.
   2) Ensures every table is wrapped (safety) without altering your HTML if it already is.
*/
(() => {
  const WRAP_SELECTOR = '.table-wrap';

  // 1) Ensure wrap exists (defensive; your HTML already has it)
  document.querySelectorAll('table').forEach(tbl => {
    const parent = tbl.parentElement;
    if (!parent || !parent.classList || !parent.classList.contains('table-wrap')) {
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      parent?.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    }
  });

  // 2) Scroll shadow logic for non-card (wide) mode
  const wraps = Array.from(document.querySelectorAll(WRAP_SELECTOR));

  const setShadows = (el) => {
    // If we’re in card mode (<=560px), bail (CSS hides shadows then)
    if (window.matchMedia('(max-width: 560px)').matches) {
      el.removeAttribute('data-shadow-left');
      el.removeAttribute('data-shadow-right');
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxLeft = 2; // small epsilon to hide shadow when at the edge
    const atStart = scrollLeft <= maxLeft;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - maxLeft;

    el.setAttribute('data-shadow-left', (!atStart).toString());
    el.setAttribute('data-shadow-right', (!atEnd).toString());
  };

  const attach = (el) => {
    setShadows(el);
    el.addEventListener('scroll', () => setShadows(el), { passive: true });
  };

  // Initialize all wraps
  wraps.forEach(attach);

  // Recompute on resize (debounced with rAF)
  let raf = 0;
  const onResize = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => wraps.forEach(setShadows));
  };
  window.addEventListener('resize', onResize, { passive: true });
})();

// === searchbar-mini.js (optional: adds a small clear “×” when typing) ===
(() => {
  const input = document.getElementById('cryptoSearch');
  const bar = input?.closest('.searchbar');
  if (!input || !bar) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.setAttribute('aria-label','Clear');
  btn.textContent = '×';
  Object.assign(btn.style, {
    position:'absolute', insetInlineEnd:'0.5rem', insetBlockStart:'50%',
    transform:'translateY(-50%)', display:'none',
    minWidth:'36px', minHeight:'36px', border:'0', background:'transparent',
    cursor:'pointer', borderRadius:'6px'
  });

  const holder = document.createElement('span');
  holder.style.position = 'relative';
  input.insertAdjacentElement('afterend', holder);
  holder.appendChild(btn);

  const toggle = () => { btn.style.display = input.value ? 'inline-block' : 'none'; };
  btn.addEventListener('click', () => { input.value=''; input.dispatchEvent(new Event('input',{bubbles:true})); input.focus({preventScroll:true}); toggle(); });
  input.addEventListener('input', toggle);
  input.addEventListener('focus', toggle);
  input.addEventListener('blur', toggle);
  toggle();
})();

// PG: Prompt Gallery (namespaced, no globals)
(() => {
  // Keep URLs unlinked for now per request
  const FREE_URL = '#';
  const PRO_URL = '#';

  const $ = (sel, ctx=document) => ctx.querySelector(sel);
  const grid = $('#pg-grid');
  const searchEl = $('#pg-search');
  const sortEl = $('#pg-sort');
  const clearEl = $('#pg-clear');
  const statusEl = $('#pg-status');
  const schemaEl = $('#pg-schema');
  const ctaFree = $('#pg-free-cta');
  const ctaPro = $('#pg-pro-cta');
  const stickyFree = $('#pg-sticky-free');
  const stickyPro = $('#pg-sticky-pro');
  const stickyBar = $('#pg-sticky');
  const toastEl = $('#pg-toast');

  const hrefAttr = (a) => (a ? a.getAttribute('href') || '' : '');
  if (ctaFree && (!hrefAttr(ctaFree) || hrefAttr(ctaFree) === '#')) ctaFree.href = FREE_URL;
  if (ctaPro && (!hrefAttr(ctaPro) || hrefAttr(ctaPro) === '#')) ctaPro.href = PRO_URL;
  if (stickyFree && (!hrefAttr(stickyFree) || hrefAttr(stickyFree) === '#')) stickyFree.href = FREE_URL;
  if (stickyPro && (!hrefAttr(stickyPro) || hrefAttr(stickyPro) === '#')) stickyPro.href = PRO_URL;

  // Disable navigation for CTAs until URLs are finalized
  function disableNav(a){
    if (!a) return;
    const href = hrefAttr(a);
    if (href && href !== '#') return; // only disable if placeholder
    a.setAttribute('aria-disabled','true');
    a.addEventListener('click', (e)=>{ e.preventDefault(); if (statusEl) statusEl.textContent = 'Coming soon'; });
  }
  disableNav(ctaFree);
  disableNav(ctaPro);
  disableNav(stickyFree);
  disableNav(stickyPro);

  if (!grid || !searchEl || !sortEl || !clearEl || !schemaEl) return;

  let fullAll = [];
  let featured = [];
  let filtered = [];

  function safeText(v) { return v == null ? '' : String(v); }
  function pgSlug(s){ return safeText(s).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9\-]/g,''); }
  function titleOf(x) {
    return `${safeText(x.verb)} ${safeText(x.noun)}`.trim().replace(/\s+/g,' ');
  }
  function emojiFor(x){
    const v = safeText(x.verb).toLowerCase();
    const c = safeText(x.category).toLowerCase();
    if (c.includes('learn') || c.includes('educ')) return '🎓';
    if (c.includes('brain') || c.includes('idea')) return '💡';
    if (c.includes('creat')) return '🎨';
    if (v.includes('explain')) return '🧠';
    if (v.includes('generate') || v.includes('create')) return '✨';
    if (v.includes('plan')) return '🗺️';
    if (v.includes('summar')) return '📝';
    return '🔹';
  }
  function scoreText(s){
    const n = Number(s);
    if (Number.isFinite(n)) return (Math.round(n*100)/100).toString();
    return '';
  }
  function metaChips(x){
    const chips = [];
    const add = (label, val, aria) => {
      const span = document.createElement('span');
      span.className = 'pg-chip';
      span.textContent = `${label} ${val}`.trim();
      if (aria) span.setAttribute('aria-label', aria);
      chips.push(span);
    };
    if (x.length) add('⏱', x.length, `Length ${x.length}`);
    if (x.temperature != null) add('🌡', x.temperature, `Temperature ${x.temperature}`);
    if (x.max_tokens != null) add('🔢', x.max_tokens, `Max tokens ${x.max_tokens}`);
    if (x.goal) add('🎯', x.goal, `Goal ${x.goal}`);
    return chips;
  }

  function badge(label) {
    const s = document.createElement('span');
    s.className = 'pg-badge';
    s.textContent = label;
    return s;
  }

  function copyText(text) {
    return navigator.clipboard?.writeText(text).catch(() => Promise.reject());
  }

  async function shareText(title, text) {
    if (navigator.share) {
      try { await navigator.share({ title, text }); return 'shared'; } catch {}
    }
    try { await copyText(text); return 'copied'; } catch { return 'error'; }
  }

  function render(items) {
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    items.forEach((x, idx) => {
      const art = document.createElement('article');
      art.className = 'pg-card';
      art.setAttribute('aria-labelledby', `pg-t-${idx}`);
      if (x.category) art.setAttribute('data-pg-cat', pgSlug(x.category));

      const header = document.createElement('div');
      header.className = 'pg-header';
      const headLeft = document.createElement('div');
      headLeft.className = 'pg-head-left';
      const emoji = document.createElement('span');
      emoji.className = 'pg-emoji';
      emoji.setAttribute('aria-hidden','true');
      emoji.textContent = emojiFor(x);
      const h = document.createElement('h3');
      h.className = 'pg-title';
      h.id = `pg-t-${idx}`;
      h.textContent = titleOf(x) || 'Prompt';
      headLeft.appendChild(emoji);
      headLeft.appendChild(h);
      header.appendChild(headLeft);

      const subject = document.createElement('p');
      subject.className = 'pg-subject';
      subject.textContent = safeText(x.subject);

      const promptBox = document.createElement('div');
      promptBox.className = 'pg-prompt';
      promptBox.setAttribute('data-open','false');
      const preId = `pg-pre-${idx}`;
      const pre = document.createElement('pre');
      pre.className = 'pg-pre';
      pre.id = preId;
      pre.textContent = safeText(x.rendered_prompt);
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'pg-toggle';
      toggle.setAttribute('aria-controls', preId);
      toggle.setAttribute('aria-expanded','false');
      toggle.textContent = 'Show prompt';
      toggle.addEventListener('click', () => {
        const isOpen = promptBox.getAttribute('data-open') === 'true';
        const next = !isOpen;
        promptBox.setAttribute('data-open', String(next));
        toggle.setAttribute('aria-expanded', String(next));
        toggle.textContent = next ? 'Hide' : 'Show prompt';
      });
      promptBox.appendChild(pre);
      promptBox.appendChild(toggle);

      const meta = document.createElement('div');
      meta.className = 'pg-meta';
      metaChips(x).forEach(c => meta.appendChild(c));

      const actions = document.createElement('div');
      actions.className = 'pg-actions';
      const btnCopy = document.createElement('button');
      btnCopy.type = 'button';
      btnCopy.className = 'pg-action';
      btnCopy.setAttribute('aria-label','Copy prompt');
      btnCopy.textContent = 'Copy Prompt';
      btnCopy.addEventListener('click', async () => {
        const ok = await copyText(safeText(x.rendered_prompt)).then(()=>true,()=>false);
        if (ok) {
          statusEl.textContent = 'Copied to clipboard';
          btnCopy.classList.add('pg-ok');
          const old = btnCopy.textContent;
          btnCopy.textContent = 'Copied ✓';
          pre.classList.add('pg-pre--flash');
          // GA4 minimal: copy_prompt
          try { gtag('event','copy_prompt',{ label: titleOf(x) || 'Prompt', rank: idx+1, location:'card' }); } catch {}
          showToast('Copied ✓');
          setTimeout(() => {
            btnCopy.classList.remove('pg-ok');
            btnCopy.textContent = old;
            pre.classList.remove('pg-pre--flash');
          }, 1200);
        } else {
          statusEl.textContent = 'Copy failed';
          showToast('Copy failed');
        }
      });
      const btnShare = document.createElement('button');
      btnShare.type = 'button';
      btnShare.className = 'pg-action';
      btnShare.setAttribute('aria-label','Share prompt');
      btnShare.textContent = 'Share';
      btnShare.addEventListener('click', async () => {
        const mode = await shareText(titleOf(x) || 'Prompt', safeText(x.rendered_prompt));
        if (mode === 'shared') {
          statusEl.textContent = 'Shared ✓';
          btnShare.classList.add('pg-ok');
          const old = btnShare.textContent; btnShare.textContent = 'Shared ✓';
          // GA4 minimal: share_prompt
          try { gtag('event','share_prompt',{ label: titleOf(x) || 'Prompt', rank: idx+1, method:'native_share', location:'card' }); } catch {}
          showToast('Shared ✓');
          setTimeout(() => { btnShare.classList.remove('pg-ok'); btnShare.textContent = old; }, 1200);
        } else if (mode === 'copied') {
          statusEl.textContent = 'Copied ✓';
          btnShare.classList.add('pg-ok');
          const old = btnShare.textContent; btnShare.textContent = 'Copied ✓';
          // GA4 minimal: share_prompt (fallback copied)
          try { gtag('event','share_prompt',{ label: titleOf(x) || 'Prompt', rank: idx+1, method:'copy_fallback', location:'card' }); } catch {}
          showToast('Copied ✓');
          setTimeout(() => { btnShare.classList.remove('pg-ok'); btnShare.textContent = old; }, 1200);
        } else {
          statusEl.textContent = 'Share unavailable';
          showToast('Share unavailable');
        }
      });
      actions.appendChild(btnCopy);
      actions.appendChild(btnShare);

      art.appendChild(header);
      art.appendChild(subject);
      art.appendChild(promptBox);
      art.appendChild(meta);
      art.appendChild(actions);
      frag.appendChild(art);
    });
    grid.appendChild(frag);
    updateSchema(items);
  }

  function matches(x, q) {
    if (!q) return true;
    const hay = [x.subject, x.category, x.domain, x.verb, x.noun, x.style, x.format, x.reason]
      .map(safeText).join(' ').toLowerCase();
    return q.split(/\s+/).every(t => hay.includes(t));
  }

  function sortItems(items, key) {
    const arr = items.slice();
    if (key === 'verb') return arr.sort((a,b) => safeText(a.verb).localeCompare(safeText(b.verb)));
    if (key === 'category') return arr.sort((a,b) => safeText(a.category).localeCompare(safeText(b.category)));
    return arr.sort((a,b) => (b.score ?? -Infinity) - (a.score ?? -Infinity));
  }

  function update() {
    const q = searchEl.value.trim().toLowerCase();
    const key = sortEl.value;
    const base = q ? fullAll : featured;
    const list = base.filter(x => matches(x, q));
    const sorted = sortItems(list, key);
    const total = sorted.length;
    filtered = q ? sorted.slice(0, 6) : sorted;
    render(filtered);
    if (q) {
      statusEl.textContent = `Showing ${filtered.length} of ${total} matches`;
    } else {
      statusEl.textContent = `Showing ${filtered.length} of ${featured.length}`;
    }
    // GA4 minimal: search_submit (debounced, avoid spamming on every keystroke)
    maybeReportSearch(q);
  }

  // Debounced GA search reporter
  let __lastQ = '';
  const __reportSearch = debounce(() => {
    if (!__lastQ || __lastQ.length < 2) return;
    try { gtag('event','search_submit',{ query: __lastQ, results: filtered.length, location:'pg' }); } catch {}
  }, 800);
  function maybeReportSearch(q){
    if (q === __lastQ) return; __lastQ = q; __reportSearch();
  }

  function updateSchema(items) {
    const take = items.slice(0, 30);
    const itemListElement = take.map((x, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'CreativeWork',
        name: titleOf(x) || 'Prompt',
        about: safeText(x.subject),
        inLanguage: 'en',
        genre: [safeText(x.category), safeText(x.domain)].filter(Boolean).join(' / '),
        text: safeText(x.rendered_prompt),
        keywords: [safeText(x.style), safeText(x.format)].filter(Boolean).join(', '),
        isAccessibleForFree: true
      }
    }));
    const obj = { '@context': 'https://schema.org', '@type': 'ItemList', itemListElement };
    schemaEl.textContent = JSON.stringify(obj);
  }

  function attachEvents() {
    searchEl.addEventListener('input', () => { update(); });
    sortEl.addEventListener('change', () => { update(); });
    clearEl.addEventListener('click', () => {
      searchEl.value = '';
      sortEl.value = 'score';
      update();
      searchEl.focus({ preventScroll: true });
    });
  }

  // Toast helper
  let toastTimer = 0;
  function showToast(msg){
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add('pg-toast--show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('pg-toast--show'), 1600);
  }


  // Hide sticky CTA on scroll down, show on scroll up (mobile-first)
  function initStickyAutoHide(){
    if (!stickyBar) return;
    let lastY = window.scrollY || 0;
    let ticking = false;
    let hideTimer = 0;
    const onScroll = () => {
      if (ticking) return; ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const dy = y - lastY;
        if (y > 80 && dy > 2) {
          clearTimeout(hideTimer);
          hideTimer = setTimeout(() => stickyBar.classList.add('pg-sticky--hidden'), 100);
        } else if (dy < -2) {
          clearTimeout(hideTimer);
          stickyBar.classList.remove('pg-sticky--hidden');
        }
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Minimal outbound helper with GA4 event_callback reliability
  window.pgOutbound = function(url, params = {}, newTab = false){
    const open = () => {
      try {
        if (newTab) { window.open(url, '_blank', 'noopener'); }
        else { window.location.href = url; }
      } catch { window.location.href = url; }
    };
    try {
      if (typeof gtag === 'function') {
        gtag('event','cta_click', { ...params, link_url: url, event_callback: open });
        setTimeout(open, 800);
      } else {
        open();
      }
    } catch {
      open();
    }
    return false; // prevent default navigation
  };

  // Ensure GA event fires before starting a file download (same-origin)
  window.pgDownloadOutbound = function(anchorEl, params = {}){
    try {
      const url = anchorEl.getAttribute('href');
      const fileName = anchorEl.getAttribute('download') || '';
      const trigger = () => {
        try {
          const a = document.createElement('a');
          a.href = url;
          if (fileName) a.setAttribute('download', fileName);
          a.style.display = 'none';
          document.body.appendChild(a);
          a.click();
          setTimeout(() => a.remove(), 0);
        } catch { window.location.href = url; }
      };
      if (typeof gtag === 'function') {
        gtag('event','cta_click', { ...params, link_url: url, file_name: fileName, type:'download', event_callback: trigger });
        setTimeout(trigger, 800);
      } else {
        trigger();
      }
    } catch { /* no-op */ }
    return false; // prevent default
  };

  async function init() {
    try {
      statusEl.textContent = 'Loading prompts…';
      const res = await fetch('/prompts.jsonl');
      if (!res.ok) throw new Error('Fetch failed');
      const txt = await res.text();
      const out = [];
      txt.split(/\r?\n/).forEach((line) => {
        const s = line.trim();
        if (!s) return;
        try { out.push(JSON.parse(s)); } catch {}
      });
      // Store full dataset and compute featured top 6 by score
      fullAll = out;
      featured = out.slice().sort((a,b) => (b.score ?? -Infinity) - (a.score ?? -Infinity)).slice(0, 6);
      attachEvents();
      update();
      initStickyAutoHide();
    } catch (e) {
      statusEl.textContent = 'Could not load prompts.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
