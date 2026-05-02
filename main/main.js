/** Node-only: `node main.js` regenerates reference/chains/*.html and reference/models/*.html. Skipped in the browser (require/module absent). */
(function referencePagesGeneratorCli() {
  if (typeof require === "undefined" || typeof module === "undefined") return;
  if (require.main !== module) return;

  const fs = require("fs");
  const path = require("path");

const REF_CHAIN_ROWS = [
  { id: "bitcoin", name: "Bitcoin", ticker: "BTC", layer: "L1", consensus: "PoW", year: 2009, desc: "Original peer-to-peer cash. Nakamoto consensus, UTXO model, SHA-256 mining.", whitepaper: "https://bitcoin.org/bitcoin.pdf" },
  { id: "ethereum", name: "Ethereum", ticker: "ETH", layer: "L1", consensus: "PoS", year: 2015, desc: "Programmable blockchain. EVM, smart contracts, Gasper proof-of-stake consensus.", whitepaper: "https://ethereum.org/en/whitepaper/" },
  { id: "solana", name: "Solana", ticker: "SOL", layer: "L1", consensus: "PoH", year: 2020, desc: "High-throughput L1. Proof-of-History clock + Tower BFT. Sealevel parallel VM.", whitepaper: "https://solana.com/solana-whitepaper.pdf" },
  { id: "cardano", name: "Cardano", ticker: "ADA", layer: "L1", consensus: "PoS", year: 2017, desc: "Peer-reviewed design. Ouroboros PoS, eUTXO model, Plutus smart contracts.", whitepaper: "https://docs.cardano.org/about-cardano/overview" },
  { id: "polkadot", name: "Polkadot", ticker: "DOT", layer: "L0", consensus: "NPoS", year: 2020, desc: "Multichain relay network. Nominated PoS, parachain sharding, XCM cross-chain messaging.", whitepaper: "https://polkadot.com/papers/polkadot-lightpaper.pdf" },
  { id: "avalanche", name: "Avalanche", ticker: "AVAX", layer: "L1", consensus: "Snowball", year: 2020, desc: "Triple-chain architecture (X/P/C). Snowflake/Snowball consensus, sub-second finality.", whitepaper: "https://assets.website-files.com/5d80307810123f5ffbb34d6e/6008d7bc56430d6b8792b8d1_Avalanche%20Platform%20Whitepaper.pdf" },
  { id: "cosmos", name: "Cosmos", ticker: "ATOM", layer: "L0", consensus: "BFT", year: 2019, desc: "Internet of Blockchains. Tendermint BFT, IBC protocol, app-specific chain architecture.", whitepaper: "https://cosmos.network/cosmos-whitepaper.pdf" },
  { id: "bnb-chain", name: "BNB Chain", ticker: "BNB", layer: "L1", consensus: "PoSA", year: 2020, desc: "EVM-compatible high-throughput chain. Proof-of-Staked-Authority with 21 validators.", whitepaper: "https://github.com/bnb-chain/whitepaper/blob/master/WHITEPAPER.md" },
  { id: "near", name: "NEAR Protocol", ticker: "NEAR", layer: "L1", consensus: "PoS", year: 2020, desc: "Sharded L1. Nightshade sharding, Doomslug PoS, account-based model, Rainbow Bridge.", whitepaper: "https://near.org/papers/the-official-near-white-paper/" },
  { id: "sui", name: "Sui", ticker: "SUI", layer: "L1", consensus: "BFT", year: 2023, desc: "Object-centric L1. Mysticeti BFT, Move VM, parallel object execution, DAG mempool.", whitepaper: "https://docs.sui.io/paper/sui.pdf" },
  { id: "aptos", name: "Aptos", ticker: "APT", layer: "L1", consensus: "BFT", year: 2022, desc: "Move-based L1. Block-STM parallel execution engine, DiemBFT v4 consensus protocol.", whitepaper: "https://aptos.dev/assets/files/Aptos-Whitepaper-47099b4b907b432f81fc0effd34f3b6a.pdf" },
  { id: "arbitrum", name: "Arbitrum", ticker: "ARB", layer: "L2", consensus: "Optimistic", year: 2021, desc: "Optimistic rollup on Ethereum. Nitro engine, interactive fraud proofs, EVM equivalence.", whitepaper: "https://github.com/OffchainLabs/nitro/blob/master/docs/Nitro-whitepaper.pdf" },
  { id: "optimism", name: "Optimism", ticker: "OP", layer: "L2", consensus: "Optimistic", year: 2021, desc: "OP Stack modular rollup. Bedrock architecture, fault proofs, EVM-equivalent execution.", whitepaper: "https://community.optimism.io/docs/protocol/" },
  { id: "polygon", name: "Polygon", ticker: "POL", layer: "L2", consensus: "ZK", year: 2021, desc: "ZK rollup with zkEVM. Plonky2 proving system, EVM equivalence, AggLayer aggregation.", whitepaper: "https://polygon.technology/papers/pol-whitepaper" },
  { id: "base", name: "Base", ticker: "BASE", layer: "L2", consensus: "Optimistic", year: 2023, desc: "Coinbase OP Stack rollup. Bedrock fork, EVM-equivalent execution, no native gas token.", whitepaper: "https://base.mirror.xyz/jjQnUq_UNTQOk7psnGBFop02-bLgqiqgrn9ZVFkiJj4" },
  { id: "zksync", name: "zkSync Era", ticker: "ZK", layer: "L2", consensus: "ZK", year: 2023, desc: "ZK rollup with zkEVM. Boojum proof system, native account abstraction, zkPorter DA.", whitepaper: "https://zksync.io/whitepaper.pdf" },
  { id: "stellar", name: "Stellar", ticker: "XLM", layer: "L1", consensus: "SCP", year: 2014, desc: "Federated Byzantine agreement. Stellar Consensus Protocol, built-in DEX, fast payments.", whitepaper: "https://www.stellar.org/papers/stellar-consensus-protocol" },
  { id: "algorand", name: "Algorand", ticker: "ALGO", layer: "L1", consensus: "PoS", year: 2019, desc: "Pure PoS with cryptographic sortition. Immediate finality, no forks, AVM smart contracts.", whitepaper: "https://algorandcom.cdn.prismic.io/algorandcom/d5407f96-8e7d-4418-9ce4-0ce9e42ab087_theoretical.pdf" }
];

const chainLayerColors = { L0: "#fef3c7", L1: "#dbeafe", L2: "#d1fae5" };
const chainLayerText = { L0: "#92400e", L1: "#1e40af", L2: "#065f46" };

const chainPageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}} — Pablobot</title>
  <meta name="description" content="{{name}} blockchain: {{layer}} layer, {{consensus}} consensus mechanism, launched {{year}}.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://pablobot.com/main/reference/chains/{{id}}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://pablobot.com/main/reference/chains/{{id}}.html">
  <meta property="og:title" content="{{name}} — Pablobot">
  <meta property="og:description" content="{{name}} blockchain reference — {{layer}}, {{consensus}}, {{year}}.">
  <meta property="og:image" content="https://pablobot.com/main/assets/hero/architecture-gallery-hero.webp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{name}} — Pablobot">
  <link rel="stylesheet" href="../../../style.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%23171717'>P</text></svg>">
  <style>
    .chain-header { display: flex; align-items: flex-start; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .chain-title-group { flex: 1; min-width: 200px; }
    .chain-name { font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem 0; }
    .chain-ticker { font-size: 1rem; color: #666; }
    .chain-badge { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; background: {{layerColor}}; color: {{layerText}}; }
    .chain-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .chain-meta-item { padding: 1rem; background: #f9f9f9; border-radius: 8px; }
    .chain-meta-label { font-size: 0.75rem; color: #888; text-transform: uppercase; }
    .chain-meta-value { font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem; }
    .chain-desc { line-height: 1.7; color: #444; max-width: 700px; }
    .chain-sources { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5; }
    .chain-sources h3 { font-size: 1rem; margin-bottom: 0.75rem; }
    .chain-sources a { display: block; color: #2563eb; text-decoration: none; margin: 0.5rem 0; }
    .back-link { display: inline-block; color: #666; text-decoration: none; margin-bottom: 1.5rem; }
    .back-link:hover { color: #222; }
  </style>
</head>
<body>
  <header class="header">
    <nav class="header-nav">
      <a href="/" class="header-nav-btn">← Tools</a>
      <a href="../" class="header-nav-btn">← Chains</a>
    </nav>
  </header>

  <main class="main">
    <a href="../" class="back-link">← Back to all chains</a>

    <div class="chain-header">
      <div class="chain-title-group">
        <h1 class="chain-name">{{name}}</h1>
        <p class="chain-ticker">{{ticker}}</p>
      </div>
      <span class="chain-badge">{{layer}}</span>
    </div>

    <div class="chain-meta">
      <div class="chain-meta-item">
        <div class="chain-meta-label">Layer</div>
        <div class="chain-meta-value">{{layer}}</div>
      </div>
      <div class="chain-meta-item">
        <div class="chain-meta-label">Consensus</div>
        <div class="chain-meta-value">{{consensus}}</div>
      </div>
      <div class="chain-meta-item">
        <div class="chain-meta-label">Launch</div>
        <div class="chain-meta-value">{{year}}</div>
      </div>
    </div>

    <p class="chain-desc">{{desc}}</p>

    <div class="chain-sources">
      <h3>Whitepaper</h3>
      <a href="{{whitepaper}}" target="_blank" rel="noopener">Read whitepaper →</a>
    </div>
  </main>

  <footer class="footer">
    <p class="footer-trust">Open source · Static site · No accounts</p>
    <p class="footer-meta">© 2026 Pablobot</p>
  </footer>
</body>
</html>`;

REF_CHAIN_ROWS.forEach(c => {
  const html = chainPageTemplate
    .replace(/\{\{id\}\}/g, c.id)
    .replace(/\{\{name\}\}/g, c.name)
    .replace(/\{\{ticker\}\}/g, c.ticker)
    .replace(/\{\{layer\}\}/g, c.layer)
    .replace(/\{\{consensus\}\}/g, c.consensus)
    .replace(/\{\{year\}\}/g, c.year)
    .replace(/\{\{desc\}\}/g, c.desc)
    .replace(/\{\{whitepaper\}\}/g, c.whitepaper)
    .replace('{{layerColor}}', chainLayerColors[c.layer])
    .replace('{{layerText}}', chainLayerText[c.layer]);

  const dir = path.join(__dirname, 'reference', 'chains');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, c.id + '.html'), html);
  console.log('Created:', c.id + '.html');
});

const REF_MODEL_ROWS = [
  { id: "arcee-trinity-large-400b", name: "Trinity Large 400B", family: "Arcee", provider: "Arcee AI", params: "400B", context: "128K", release: "Feb 2025", sizeClass: "Large", arch: ["MoE"], color: "#a855f7", description: "Arcee AI's flagship model featuring innovative architecture designed for efficiency and performance.", sources: [{label: "Arcee AI", url: "https://arcee.ai"}] },
  { id: "deepseek-v3-2-671b", name: "DeepSeek V3.2 671B", family: "DeepSeek", provider: "DeepSeek", params: "671B", context: "200K", release: "Jan 2025", sizeClass: "Frontier", arch: ["MoE", "MLA"], color: "#0ea5e9", description: "DeepSeek's latest MoE model with Multi-Latent Attention for superior efficiency.", sources: [{label: "GitHub", url: "https://github.com/deepseek-ai/DeepSeek-V3"}] },
  { id: "deepseek-r1-671b", name: "DeepSeek R1 671B", family: "DeepSeek", provider: "DeepSeek", params: "671B", context: "200K", release: "Jan 2025", sizeClass: "Frontier", arch: ["MoE", "RL"], color: "#0ea5e9", description: "DeepSeek's reasoning-focused model with reinforcement learning enhancements.", sources: [{label: "GitHub", url: "https://github.com/deepseek-ai/DeepSeek-R1"}] },
  { id: "gemma-3-27b", name: "Gemma 3 27B", family: "Google", provider: "Google DeepMind", params: "27B", context: "128K", release: "Mar 2025", sizeClass: "Mid-size", arch: ["GQA", "SWA"], color: "#f59e0b", description: "Google's latest efficient open model with Sliding Window Attention.", sources: [{label: "HuggingFace", url: "https://huggingface.co/google/gemma-3-27b"}] },
  { id: "glm-4-5-355b", name: "GLM 4.5 355B", family: "GLM", provider: "Zhipu AI", params: "355B", context: "1M", release: "Dec 2024", sizeClass: "Large", arch: ["MoE", "Sparse Attention"], color: "#8b5cf6", description: "Zhipu's model with groundbreaking 1M context window.", sources: [{label: "Zhipu AI", url: "https://chatglm.cn"}] },
  { id: "glm-4-7-355b", name: "GLM 4.7 355B", family: "GLM", provider: "Zhipu AI", params: "355B", context: "1M", release: "Feb 2025", sizeClass: "Large", arch: ["MoE", "Sparse Attention"], color: "#8b5cf6", description: "Updated GLM with enhanced capabilities and 1M context.", sources: [{label: "Zhipu AI", url: "https://chatglm.cn"}] },
  { id: "glm-5-744b", name: "GLM 5 744B", family: "GLM", provider: "Zhipu AI", params: "744B", context: "1M", release: "Mar 2025", sizeClass: "Frontier", arch: ["MoE", "Sparse Attention"], color: "#8b5cf6", description: "Zhipu's largest model with full 1M context and advanced architecture.", sources: [{label: "Zhipu AI", url: "https://chatglm.cn"}] },
  { id: "gpt-oss-120b", name: "GPT OSS 120B", family: "OpenAI", provider: "OpenAI", params: "120B", context: "32K", release: "May 2024", sizeClass: "Large", arch: ["Dense"], color: "#10b981", description: "OpenAI's open-source research release for the community.", sources: [] },
  { id: "gpt-oss-20b", name: "GPT OSS 20B", family: "OpenAI", provider: "OpenAI", params: "20B", context: "32K", release: "May 2024", sizeClass: "Mid-size", arch: ["Dense"], color: "#10b981", description: "Compact open model from OpenAI's research initiatives.", sources: [] },
  { id: "grok-2-5-270b", name: "Grok 2.5 270B", family: "xAI", provider: "xAI", params: "270B", context: "131K", release: "Nov 2024", sizeClass: "Large", arch: ["MoE"], color: "#64748b", description: "xAI's Grok with real-time knowledge and unique personality.", sources: [{label: "xAI", url: "https://x.ai"}] },
  { id: "kimi-k2-1t", name: "Kimi K2 1T", family: "Moonshot", provider: "Moonshot AI", params: "1T", context: "1M", release: "Mar 2025", sizeClass: "Frontier", arch: ["MoE"], color: "#06b6d4", description: "Trillion-parameter model with industry-leading 1M context.", sources: [{label: "Moonshot AI", url: "https://kimi.moonshot.cn"}] },
  { id: "kimi-linear-48b-a3b", name: "Kimi Linear 48B A3B", family: "Moonshot", provider: "Moonshot AI", params: "48B", context: "1M", release: "Feb 2025", sizeClass: "Mid-size", arch: ["MoE"], color: "#06b6d4", description: "Efficient MoE variant with 1M context window.", sources: [{label: "Moonshot AI", url: "https://kimi.moonshot.cn"}] },
  { id: "llama-3-8b", name: "Llama 3 8B", family: "Meta", provider: "Meta AI", params: "8B", context: "128K", release: "Apr 2024", sizeClass: "Small", arch: ["Dense", "GQA"], color: "#3b82f6", description: "Meta's popular open model, cornerstone of the ecosystem.", sources: [{label: "Meta AI", url: "https://llama.meta.com/llama3"}] },
  { id: "llama-4-maverick-400b", name: "Llama 4 Maverick 400B", family: "Meta", provider: "Meta AI", params: "400B", context: "1M", release: "Mar 2025", sizeClass: "Large", arch: ["MoE", "Gated Attention"], color: "#3b82f6", description: "Meta's latest with Gated Attention and 1M context.", sources: [{label: "Meta AI", url: "https://llama.meta.com"}] },
  { id: "minimax-m2-230b", name: "MiniMax M2 230B", family: "MiniMax", provider: "MiniMax", params: "230B", context: "1M", release: "Jan 2025", sizeClass: "Large", arch: ["MoE"], color: "#ec4899", description: "MiniMax's powerful MoE model with 1M context.", sources: [{label: "MiniMax", url: "https://www.minimax.io"}] },
  { id: "minimax-m2-5-230b", name: "MiniMax M2.5 230B", family: "MiniMax", provider: "MiniMax", params: "230B", context: "1M", release: "Feb 2025", sizeClass: "Large", arch: ["MoE"], color: "#ec4899", description: "Updated MiniMax with enhanced capabilities.", sources: [{label: "MiniMax", url: "https://www.minimax.io"}] },
  { id: "mistral-3-1-small-24b", name: "Mistral 3.1 Small 24B", family: "Mistral", provider: "Mistral AI", params: "24B", context: "128K", release: "Feb 2025", sizeClass: "Mid-size", arch: ["GQA"], color: "#f97316", description: "Mistral's efficient model with strong coding capabilities.", sources: [{label: "Mistral AI", url: "https://mistral.ai"}] },
  { id: "mistral-3-large-673b", name: "Mistral 3 Large 673B", family: "Mistral", provider: "Mistral AI", params: "673B", context: "1M", release: "Mar 2025", sizeClass: "Frontier", arch: ["MoE"], color: "#f97316", description: "Mistral's flagship frontier model with 1M context.", sources: [{label: "Mistral AI", url: "https://mistral.ai"}] },
  { id: "nemotron-3-nano-30b-a3b", name: "Nemotron 3 Nano 30B A3B", family: "Nvidia", provider: "NVIDIA", params: "30B", context: "128K", release: "Nov 2024", sizeClass: "Mid-size", arch: ["GQA"], color: "#22c55e", description: "NVIDIA's efficient model optimized for inference.", sources: [{label: "NVIDIA", url: "https://developer.nvidia.com/nemotron-3"}] },
  { id: "nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B A12B", family: "Nvidia", provider: "NVIDIA", params: "120B", context: "128K", release: "Dec 2024", sizeClass: "Large", arch: ["MoE"], color: "#22c55e", description: "NVIDIA's supercharged MoE for enterprise workloads.", sources: [{label: "NVIDIA", url: "https://developer.nvidia.com/nemotron-3"}] },
  { id: "olmo-2-7b", name: "OLMo 2 7B", family: "AllenAI", provider: "Allen AI", params: "7B", context: "4K", release: "Oct 2024", sizeClass: "Small", arch: ["Dense"], color: "#84cc16", description: "Allen AI's fully open training pipeline model.", sources: [{label: "Allen AI", url: "https://allenai.org/olmo"}] },
  { id: "olmo-3-32b", name: "OLMo 3 32B", family: "AllenAI", provider: "Allen AI", params: "32B", context: "4K", release: "Feb 2025", sizeClass: "Mid-size", arch: ["Dense"], color: "#84cc16", description: "OLMo 3 mid-tier with open training data.", sources: [{label: "Allen AI", url: "https://allenai.org/olmo"}] },
  { id: "olmo-3-7b", name: "OLMo 3 7B", family: "AllenAI", provider: "Allen AI", params: "7B", context: "4K", release: "Feb 2025", sizeClass: "Small", arch: ["Dense"], color: "#84cc16", description: "Latest OLMo 3 with improved training.", sources: [{label: "Allen AI", url: "https://allenai.org/olmo"}] },
  { id: "qwen3-235b-a22b", name: "Qwen3 235B A22B", family: "Qwen", provider: "Alibaba Cloud", params: "235B", context: "32K", release: "Mar 2025", sizeClass: "Large", arch: ["MoE", "Gated Attention"], color: "#ef4444", description: "Qwen's MoE with 22 active experts.", sources: [{label: "Qwen", url: "https://qwen.ai"}] },
  { id: "qwen3-32b", name: "Qwen3 32B", family: "Qwen", provider: "Alibaba Cloud", params: "32B", context: "32K", release: "Mar 2025", sizeClass: "Mid-size", arch: ["Dense"], color: "#ef4444", description: "Qwen's popular dense model with strong multilingual support.", sources: [{label: "Qwen", url: "https://qwen.ai"}] },
  { id: "qwen3-4b", name: "Qwen3 4B", family: "Qwen", provider: "Alibaba Cloud", params: "4B", context: "32K", release: "Mar 2025", sizeClass: "Small", arch: ["Dense"], color: "#ef4444", description: "Compact Qwen3 for efficient deployment.", sources: [{label: "Qwen", url: "https://qwen.ai"}] },
  { id: "qwen3-5-397b", name: "Qwen3.5 397B", family: "Qwen", provider: "Alibaba Cloud", params: "397B", context: "32K", release: "Sep 2024", sizeClass: "Large", arch: ["MoE", "Gated Attention"], color: "#ef4444", description: "Qwen3.5 flagship with Gated DeltaNet.", sources: [{label: "Qwen", url: "https://qwen.ai"}] },
  { id: "qwen3-8b", name: "Qwen3 8B", family: "Qwen", provider: "Alibaba Cloud", params: "8B", context: "32K", release: "Mar 2025", sizeClass: "Small", arch: ["Dense"], color: "#ef4444", description: "Qwen3's entry-level dense model.", sources: [{label: "Qwen", url: "https://qwen.ai"}] },
  { id: "qwen3-next-80b-a3b", name: "Qwen3 Next 80B A3B", family: "Qwen", provider: "Alibaba Cloud", params: "80B", context: "32K", release: "Feb 2025", sizeClass: "Mid-size", arch: ["MoE", "Gated Attention"], color: "#ef4444", description: "Qwen3 Next with 3 active experts.", sources: [{label: "Qwen", url: "https://qwen.ai"}] }
];

const modelPageTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{name}} — Pablobot</title>
  <meta name="description" content="{{name}} AI model: {{params}} parameters, {{context}} context.">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://pablobot.com/main/reference/models/{{id}}.html">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://pablobot.com/main/reference/models/{{id}}.html">
  <meta property="og:title" content="{{name}} — Pablobot">
  <meta property="og:description" content="{{name}} — {{params}}, {{context}} context. LLM reference on Pablobot.">
  <meta property="og:image" content="https://pablobot.com/main/assets/hero/architecture-gallery-hero.webp">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{name}} — Pablobot">
  <link rel="stylesheet" href="../../../style.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90' fill='%23171717'>P</text></svg>">
  <style>
    .model-header { display: flex; align-items: flex-start; gap: 2rem; margin-bottom: 2rem; flex-wrap: wrap; }
    .model-title-group { flex: 1; min-width: 200px; }
    .model-name { font-size: 2rem; font-weight: 700; margin: 0 0 0.5rem 0; }
    .model-family { font-size: 1rem; color: #666; }
    .model-badge { display: inline-block; padding: 0.5rem 1rem; border-radius: 6px; font-weight: 600; background: {{color}}; color: white; }
    .model-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin: 2rem 0; }
    .model-meta-item { padding: 1rem; background: #f9f9f9; border-radius: 8px; }
    .model-meta-label { font-size: 0.75rem; color: #888; text-transform: uppercase; }
    .model-meta-value { font-size: 1.25rem; font-weight: 600; margin-top: 0.25rem; }
    .model-arch { display: flex; gap: 0.5rem; flex-wrap: wrap; margin: 1rem 0; }
    .arch-tag { display: inline-block; padding: 0.25rem 0.75rem; background: #f3f4f6; border-radius: 4px; font-size: 0.875rem; }
    .model-desc { line-height: 1.7; color: #444; max-width: 700px; }
    .model-sources { margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #e5e5e5; }
    .model-sources h3 { font-size: 1rem; margin-bottom: 0.75rem; }
    .model-sources a { display: block; color: #2563eb; text-decoration: none; margin: 0.5rem 0; }
    .back-link { display: inline-block; color: #666; text-decoration: none; margin-bottom: 1.5rem; }
    .back-link:hover { color: #222; }
  </style>
</head>
<body>
  <header class="header">
    <nav class="header-nav">
      <a href="/" class="header-nav-btn">← Tools</a>
      <a href="../" class="header-nav-btn">← Models</a>
    </nav>
  </header>

  <main class="main">
    <a href="../" class="back-link">← Back to all models</a>

    <div class="model-header">
      <div class="model-title-group">
        <h1 class="model-name">{{name}}</h1>
        <p class="model-family">{{family}} family · {{provider}}</p>
      </div>
      <span class="model-badge">{{params}}</span>
    </div>

    <div class="model-meta">
      <div class="model-meta-item">
        <div class="model-meta-label">Parameters</div>
        <div class="model-meta-value">{{params}}</div>
      </div>
      <div class="model-meta-item">
        <div class="model-meta-label">Context Length</div>
        <div class="model-meta-value">{{context}}</div>
      </div>
      <div class="model-meta-item">
        <div class="model-meta-label">Released</div>
        <div class="model-meta-value">{{release}}</div>
      </div>
      <div class="model-meta-item">
        <div class="model-meta-label">Size Class</div>
        <div class="model-meta-value">{{sizeClass}}</div>
      </div>
    </div>

    <div class="model-arch">
      {{archTags}}
    </div>

    <p class="model-desc">{{description}}</p>

    {{sourcesHtml}}
  </main>

  <footer class="footer">
    <p class="footer-trust">Open source · Static site · No accounts</p>
    <p class="footer-meta">© 2026 Pablobot</p>
  </footer>
</body>
</html>`;

REF_MODEL_ROWS.forEach(m => {
  const archTags = m.arch.map(a => `<span class="arch-tag">${a}</span>`).join("\n  ");
  const sourcesHtml = m.sources.length > 0
    ? `    <div class="model-sources">
      <h3>Sources</h3>
      ${m.sources.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.label} →</a>`).join("\n      ")}
    </div>`
    : '';

  let html = modelPageTemplate
    .replace(/\{\{id\}\}/g, m.id)
    .replace(/\{\{name\}\}/g, m.name)
    .replace(/\{\{family\}\}/g, m.family)
    .replace(/\{\{provider\}\}/g, m.provider)
    .replace(/\{\{params\}\}/g, m.params)
    .replace(/\{\{context\}\}/g, m.context)
    .replace(/\{\{release\}\}/g, m.release)
    .replace(/\{\{sizeClass\}\}/g, m.sizeClass)
    .replace(/\{\{color\}\}/g, m.color)
    .replace(/\{\{description\}\}/g, m.description)
    .replace('{{archTags}}', archTags)
    .replace('{{sourcesHtml}}', sourcesHtml);

  const dir = path.join(__dirname, 'reference', 'models');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, m.id + '.html'), html);
  console.log('Created:', m.id + '.html');
});
  console.log("Reference pages written: reference/chains/, reference/models/");

  // Sitemap: derived from TOOLS slugs in this file + reference routes (single source of truth for crawl lists).
  const SITE = "https://pablobot.com";
  const mainJsPath = path.join(__dirname, "main.js");
  const srcBundle = fs.readFileSync(mainJsPath, "utf8");
  const toolsMarker = "const TOOLS = [";
  // Browser bundle also assigns toolsMarker string constant above — use last occurrence for real TOOLS array.
  const toolsIdx = srcBundle.lastIndexOf(toolsMarker);
  if (toolsIdx === -1) throw new Error("Sitemap: const TOOLS block not found in main.js");
  let depth = 1;
  let pos = toolsIdx + toolsMarker.length;
  while (pos < srcBundle.length && depth > 0) {
    const ch = srcBundle[pos++];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
  }
  const toolsSlice = srcBundle.slice(toolsIdx + toolsMarker.length, pos - 1);
  const toolSlugs = [...new Set([...toolsSlice.matchAll(/slug:"([^"]+)"/g)].map((m) => m[1]))].filter((s) =>
    /^[a-z0-9-]+$/.test(s)
  );
  const locs = new Set();
  locs.add(`${SITE}/`);
  toolSlugs.forEach((s) => locs.add(`${SITE}/${s}/`));
  const refIndexPaths = [
    "/main/reference/",
    "/main/reference/models/",
    "/main/reference/chains/",
    "/main/reference/compare/models.html",
    "/main/reference/compare/chains.html",
    "/main/reference/concepts/",
    "/main/reference/families/",
  ];
  refIndexPaths.forEach((p) => locs.add(SITE + p));
  REF_CHAIN_ROWS.forEach((c) => locs.add(`${SITE}/main/reference/chains/${c.id}.html`));
  REF_MODEL_ROWS.forEach((m) => locs.add(`${SITE}/main/reference/models/${m.id}.html`));

  const xmlEsc = (u) =>
    u.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const urlEntries = [...locs]
    .sort()
    .map((loc) => `  <url><loc>${xmlEsc(loc)}</loc></url>`)
    .join("\n");
  const sitemapBody = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>
`;
  const siteRoot = path.join(__dirname, "..");
  fs.writeFileSync(path.join(siteRoot, "sitemap.xml"), sitemapBody);
  console.log("Created: sitemap.xml");

  process.exit(0);
})();

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
      {name:"Lorem Generator",slug:"lorem-generator",category:"code",icon:"📜",desc:"Placeholder text"},
      {name:"API Tester",slug:"api-tester",category:"code",icon:"🧪",desc:"HTTP requests from the browser"},
      {name:"ASCII Table",slug:"ascii-table",category:"code",icon:"📋",desc:"ASCII / hex reference"},

      // Design
      {name:"Color Scheme",slug:"color-scheme",category:"design",icon:"🌈",desc:"Generate palettes"},
      {name:"Gradient Generator",slug:"gradient-generator",category:"design",icon:"🌅",desc:"CSS gradients"},
      {name:"Hex Palette",slug:"hex-palette",category:"design",icon:"🖌️",desc:"Color palette"},
      {name:"Social Card",slug:"social-card",category:"design",icon:"📱",desc:"Design social cards"},
      {name:"Generative Art",slug:"generative-art",category:"design",icon:"✨",desc:"Mathematical art generation"},
      {name:"Audio Visualizer",slug:"audio-visualizer",category:"design",icon:"🎵",desc:"Realtime audio FFT"},
      {name:"QR Generator",slug:"qr-generator",category:"design",icon:"📱",desc:"Generate QR codes"},
      {name:"Color Mixer",slug:"color-mixer",category:"design",icon:"🎨",desc:"Blend hex colors"},

      // Data
      {name:"Base64",slug:"base64",category:"data",icon:"🔤",desc:"Encode/decode Base64"},
      {name:"Binary Converter",slug:"binary-converter",category:"data",icon:"0️⃣",desc:"Binary/hex converter"},

      // Math
      {name:"Complex Plane",slug:"complex-plane",category:"math",icon:"📊",desc:"Julia sets visualization"},
      {name:"Conway's Game",slug:"conway-game",category:"math",icon:"🧬",desc:"Cellular automaton simulator"},
      {name:"Fourier Visualizer",slug:"fourier-visualizer",category:"math",icon:"〰️",desc:"FFT decomposition"},
      {name:"Graphing Calculator",slug:"graphing-calculator",category:"math",icon:"📈",desc:"Plot functions"},
      {name:"Linear Solver",slug:"linear-solver",category:"math",icon:"➗",desc:"Solve linear equations"},
      {name:"Matrix Calculator",slug:"matrix-calculator",category:"math",icon:"🔢",desc:"Matrix operations"},
      {name:"Lorenz Attractor",slug:"lorenz-attractor",category:"math",icon:"🌀",desc:"Chaos 3D visualization"},
      {name:"Solar System",slug:"solar-system",category:"math",icon:"🪐",desc:"Orbital visualization"},

      // AI
      {name:"Token Counter",slug:"token-counter",category:"ai",icon:"🔢",desc:"Count tokens"},
      {name:"Context Packer",slug:"context-packer",category:"ai",icon:"📦",desc:"Pack context for LLMs"},

      // Tools
      {name:"Aspect Ratio",slug:"aspect-ratio",category:"tools",icon:"📐",desc:"Image dimension calculator"},
      {name:"Countdown Timer",slug:"countdown-timer",category:"tools",icon:"⏱",desc:"Countdown to date"},
      {name:"DNA Helix",slug:"dna-helix",category:"tools",icon:"🔬",desc:"3D DNA visualization"},
      {name:"System Health",slug:"system-health",category:"tools",icon:"💚",desc:"Browser and machine diagnostics"},
      {name:"Timezone Converter",slug:"timezone-converter",category:"tools",icon:"🌍",desc:"Time zones"},
      {name:"Word Counter",slug:"word-counter",category:"tools",icon:"📊",desc:"Count words"},
      {name:"CV Builder",slug:"cv-builder",category:"tools",icon:"📋",desc:"Upload, clean, export PDF"},
      {name:"Pomodoro Timer",slug:"pomodoro-timer",category:"tools",icon:"🍅",desc:"Focus intervals"},
      {name:"Reading Estimator",slug:"reading-estimator",category:"tools",icon:"📖",desc:"Reading time estimate"},
      {name:"Typing Test",slug:"typing-test",category:"tools",icon:"⌨️",desc:"WPM speed and accuracy"},
      {name:"Epoch Converter",slug:"epoch-converter",category:"tools",icon:"⏳",desc:"Unix time and locale dates"},
      {name:"Password Generator",slug:"password-generator",category:"tools",icon:"🔑",desc:"Random passwords"},
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
    const THEME_KEY = "pablobot_theme_v1";

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

    function initTheme() {
      const saved = localStorage.getItem(THEME_KEY);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const mode = saved === "light" || saved === "dark" ? saved : (prefersDark ? "dark" : "light");
      document.documentElement.dataset.theme = mode;
      const toggle = document.getElementById("themeToggle");
      if (toggle) {
        toggle.textContent = mode === "dark" ? "☀️" : "🌙";
        toggle.setAttribute("aria-pressed", mode === "dark" ? "true" : "false");
        toggle.title = mode === "dark" ? "Switch to light theme" : "Switch to dark theme";
      }
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", mode === "dark" ? "#141414" : "#fafafa");
    }

    function init() {
      initTheme();
      const themeToggle = document.getElementById("themeToggle");
      if (themeToggle) {
        themeToggle.addEventListener("click", () => {
          const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
          localStorage.setItem(THEME_KEY, next);
          initTheme();
        });
      }
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (!localStorage.getItem(THEME_KEY)) initTheme();
      });
      applyUrlToState();
      const heroStats = document.getElementById("heroStats");
      if (heroStats) heroStats.textContent = `${TOOLS.length} curated tools · static · no signup · ${WIP_TOOLS.length} more in the lab`;
      renderTabs();
      renderTools(searchInput ? searchInput.value : "");
      renderRecentStrip();
      initPageBehaviours();
    }

    function renderTabs() {
      let html = `<button type="button" class="tab ${activeCategory === "all" ? "active" : ""}" data-cat="all">All</button>`;
      for (const [key, val] of Object.entries(CATEGORIES)) {
        const count = TOOLS.filter(t => t.category === key).length;
        if (count < 2) continue;
        html += `<button type="button" class="tab ${activeCategory === key ? "active" : ""}" data-cat="${key}">${val.name} (${count})</button>`;
      }
      tabsEl.innerHTML = html;
    }

    function renderTools(filter = "") {
      const q = filter.toLowerCase().trim();
      let filtered = activeCategory === "all" ? TOOLS : TOOLS.filter(t => t.category === activeCategory);
      if (q) {
        filtered = filtered.filter(t => {
          const catLabel = (CATEGORIES[t.category] && CATEGORIES[t.category].name) || "";
          const hay = `${t.name} ${t.desc} ${t.slug} ${catLabel}`.toLowerCase();
          return hay.includes(q);
        });
      }

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
        <a href="${escapeHtml(tool.slug)}/" class="tool-card" data-tool-slug="${escapeHtml(tool.slug)}">
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
        if (headerEl) headerEl.classList.toggle("scrolled", window.scrollY > 10);
      }, { passive: true });

      // "/" shortcut focuses search
      document.addEventListener("keydown", e => {
        const ae = document.activeElement;
        if (e.key === "/" && ae !== searchInput &&
            !["INPUT", "TEXTAREA", "SELECT"].includes(ae.tagName) &&
            !(ae && ae.isContentEditable)) {
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

    /* WIP lab grid only. Flywheel: add row while there is no root index.html → ship tool → delete row here,
       register in TOOLS + README live table. Never list a slug that already ships in TOOLS (duplicate cards).
       Stack `type` is the honest runtime (Python/Flask/etc.); flip to "Web" if we later wrap as static-only. */
    const WIP_TOOLS = [
      // No production index.html yet
      { name:"ASCII Art",           slug:"ascii-art",           icon:"🎨", desc:"Generate ASCII art from text",           type:"Web" },
      { name:"Auto-Prompter",       slug:"auto-prompter",       icon:"🤖", desc:"Prompt chaining and automation",         type:"Web" },
      { name:"Prompt Tester",       slug:"prompt-tester",       icon:"💬", desc:"Test and compare AI prompts",            type:"Web" },
      { name:"Text Summarizer",     slug:"text-summarizer",     icon:"📝", desc:"Summarize text with AI",                 type:"Web" },
      { name:"PDF Summarizer",      slug:"pdf-summarizer",      icon:"📕", desc:"Extract and summarize PDF content in-browser", type:"Web" },
      { name:"Image Analyzer",      slug:"image-analyzer",      icon:"🖼️", desc:"Inspect images with captions and metadata locally", type:"Web" },
      { name:"Code Explainer",      slug:"code-explainer",      icon:"📘", desc:"Explain snippets or files without leaving the tab", type:"Web" },
      { name:"Meeting Notes Cleaner", slug:"meeting-notes-cleaner", icon:"🗒️", desc:"Structure and clean raw meeting notes", type:"Web" },
      { name:"URL Shortener",       slug:"url-shortener",       icon:"🔗", desc:"Shorten URLs client-side or via static mapping", type:"Web" },
      { name:"Cache Cleaner",       slug:"cache-cleaner",       icon:"🧹", desc:"Browser cache management tool",          type:"Web" },
      { name:"Fake Data Gen",       slug:"fake-data-gen",       icon:"🎭", desc:"Generate realistic test data",           type:"Web" },
      { name:"Git Helper",          slug:"git-helper",          icon:"🌿", desc:"Git commands and workflow assistant",     type:"Web" },
      { name:"LLM Cost Tracker",    slug:"llm-cost-tracker",    icon:"💰", desc:"Track and estimate AI API spending",     type:"Web" },
      { name:"Maze Master",         slug:"maze-master",         icon:"🧩", desc:"Maze generation and pathfinding",        type:"Web" },
      { name:"MD to HTML",          slug:"md2html",             icon:"📄", desc:"Markdown to HTML converter",             type:"Python" },
      { name:"Mini Agents",         slug:"mini-agents",         icon:"🤖", desc:"Lightweight AI agent runner",            type:"Python" },
      { name:"Secure Vault",        slug:"secure-vault",        icon:"🔒", desc:"Encrypted local password vault",         type:"Web" },
      { name:"SEO Intel",           slug:"seo-intel",           icon:"🔍", desc:"SEO analysis and keyword insights",      type:"Flask" },
      // No web UI — scripts only
      { name:"Backup Mirror",       slug:"backup-mirror",       icon:"🪞", desc:"Sync and mirror file backups",           type:"PowerShell" },
      { name:"CPU Benchmark",       slug:"cpu-benchmark",       icon:"⚡", desc:"Measure and compare CPU performance",    type:"PowerShell" },
      { name:"Disk Space Health",   slug:"disk-space-health",   icon:"💾", desc:"Visualise and monitor disk usage",       type:"PowerShell" },
      { name:"Git Worktree",        slug:"git-worktree",        icon:"🌿", desc:"Manage multiple git worktrees",          type:"Shell" },
      { name:"RSA Key Generator",   slug:"rsa-keygen",          icon:"🔑", desc:"Generate RSA key pairs locally",         type:"Rust" },
    ];

    function renderWipTools() {
      const grid = document.getElementById("wipGrid");
      if (!grid) return;
      const typeClass = { Web:"web", PowerShell:"powershell", Shell:"shell", Rust:"rust", Python:"python", Flask:"flask" };
      grid.innerHTML = WIP_TOOLS.map(t => `
        <div class="wip-card" title="${t.name} — coming soon">
          <span class="wip-card-badge">WIP</span>
          <div class="wip-card-icon">${t.icon}</div>
          <div class="wip-card-name">${t.name}</div>
          <span class="wip-card-type wip-card-type--${typeClass[t.type] || "web"}">${t.type}</span>
          <div class="wip-card-bar"><div class="wip-card-bar-fill"></div></div>
        </div>`).join("");
    }

    if (tabsEl && toolsGridEl && searchInput && searchClear && toolCount) {
      init();
    }
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
    const aiModelsBtn    = document.getElementById("aiModelsBtn");
    const galleryContent = document.getElementById("galleryContent");
    const modelsGrid     = document.getElementById("modelsGrid");
    const conceptsGrid   = document.getElementById("conceptsGrid");
    const lightboxEl     = document.getElementById("lightbox");
    const lightboxImg    = document.getElementById("lightboxImg");
    const lightboxTitle  = document.getElementById("lightboxTitle");
    const lightboxMeta   = document.getElementById("lightboxMeta");

    const cryptoGalleryEl = document.getElementById("cryptoGallery");
    const cryptoContentEl = document.getElementById("cryptoContent");
    const cryptoBtn       = document.getElementById("cryptoBtn");

    /* ============================================================
       GALLERY OPEN / CLOSE
    ============================================================ */

    function openGallery() {
      if (!galleryEl || !aiModelsBtn || !galleryContent) return;
      _savedScrollY = window.scrollY;
      galleryEl.classList.add("gallery-open");
      galleryEl.setAttribute("aria-hidden", "false");
      aiModelsBtn.setAttribute("aria-expanded", "true");
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
      if (!galleryEl || !aiModelsBtn) return;
      galleryEl.classList.remove("gallery-open");
      galleryEl.setAttribute("aria-hidden", "true");
      aiModelsBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      window.scrollTo(0, _savedScrollY);
      aiModelsBtn.focus();
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
      if (!aiModelsBtn || !galleryEl || !galleryContent || !modelsGrid || !conceptsGrid || !lightboxEl) return;
      aiModelsBtn.addEventListener("click", openGallery);
      document.getElementById("galleryClose").addEventListener("click", closeGallery);
      document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
      document.getElementById("lightboxBackdrop").addEventListener("click", closeLightbox);
      document.getElementById("lightboxPrev").addEventListener("click", () => lightboxStep(-1));
      document.getElementById("lightboxNext").addEventListener("click", () => lightboxStep(1));

      document.addEventListener("keydown", e => {
        if (e.key === "Escape") {
          if (lightboxEl.classList.contains("lightbox-open")) { closeLightbox(); }
          else if (cryptoGalleryEl && cryptoGalleryEl.classList.contains("gallery-open")) { closeCrypto(); }
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
      if (!cryptoGalleryEl || !cryptoBtn || !cryptoContentEl) return;
      _cryptoScrollY = window.scrollY;
      cryptoGalleryEl.classList.add("gallery-open");
      cryptoGalleryEl.setAttribute("aria-hidden", "false");
      cryptoBtn.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      cryptoContentEl.scrollTop = 0;
      if (!cryptoGalleryEl.dataset.loaded) { renderChains(); cryptoGalleryEl.dataset.loaded = "true"; }
      cryptoGalleryEl.focus();
    }

    function closeCrypto() {
      if (!cryptoGalleryEl || !cryptoBtn) return;
      cryptoGalleryEl.classList.remove("gallery-open");
      cryptoGalleryEl.setAttribute("aria-hidden", "true");
      cryptoBtn.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      window.scrollTo(0, _cryptoScrollY);
      cryptoBtn.focus();
    }

    function initChain() {
      if (!cryptoBtn || !cryptoGalleryEl || !document.getElementById("cryptoClose") || !document.getElementById("chainGrid")) return;
      cryptoBtn.addEventListener("click", openCrypto);
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
