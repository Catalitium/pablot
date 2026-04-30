# Pablot

Static hub at **`/`**, **`/{slug}/`** tool apps on the **repo root**, and editable hub product under **`main/`**. **OOO** = shipped tools stay **out of** `main/` (layout in **Monolith map**).

**Support / incidents:** hub tool lists are authoritative in [`main/main.js`](main/main.js) (`TOOLS`, `WIP_TOOLS`). Run **`npm run build`** to regenerate **`main/reference/`** from **`main/content/`** and flatten **`main/index.html`**, **`main/main.js`**, **`main/style.css`** to `/` (`package.json`). Deploy: [`netlify.toml`](netlify.toml) uses **`publish = "."`** and **301** redirects **`/content/*`**, **`/reference/*`**, **`/assets/*`** → **`/main/...`**.

---

## For AI assistants: avoid context pollution

1. **Default:** use only this README plus paths or explicit tags the user gives (**`[hub]`**, **`[main/content]`**, **`[main/reference]`**, **`[tool:{slug}]`**). Do **not** enumerate unrelated root folders.
2. **Hub tool facts:** the tables below **mirror** [`main/main.js`](main/main.js). If anything disagrees, **`main/main.js` wins** — update this README in the same PR.
3. **Implementation:** do **not** deep-read a **`/{slug}/`** tree unless the task scopes **`tool:{slug}`**, **`[tool:{slug}]`**, or an explicit path.
4. **Noise:** many root dirs are experiments / legacy — **not** in the tables below.

---

## Hub catalog — live tools (`TOOLS`)

Single table; **`category`** matches hub tabs in [`main/main.js`](main/main.js).

| Category | Slug | Stack | Summary |
|----------|------|-------|---------|
| Code | `case-converter` | Static | Convert case formats |
| Code | `cron-builder` | Static | Build cron expressions |
| Code | `css-minifier` | Static | Minify CSS |
| Code | `curl-builder` | Static | Build CURL commands |
| Code | `data-converter` | Static | CSV/JSON/YAML |
| Code | `hash-generator` | Static | MD5/SHA hashes |
| Code | `json-formatter` | Static | Format JSON |
| Code | `markdown-preview` | Static | Live markdown preview |
| Code | `json-schema-generator` | Static | Generate JSON schemas |
| Code | `jwt-decoder` | Static | Decode JWT tokens |
| Code | `regex-tester` | Static | Test regex patterns |
| Code | `sql-builder` | Static | Build SQL queries |
| Code | `url-parser` | Static | Parse URLs |
| Code | `uuid-generator` | Static | Generate UUIDs |
| Code | `yaml-formatter` | Static | Format YAML |
| Design | `color-scheme` | Static | Generate palettes |
| Design | `gradient-generator` | Static | CSS gradients |
| Design | `hex-palette` | Static | Color palette |
| Design | `social-card` | Static | Design social cards |
| Design | `generative-art` | Static | Mathematical art generation |
| Design | `audio-visualizer` | Static | Realtime audio FFT |
| Data | `base64` | Static | Encode/decode Base64 |
| Data | `binary-converter` | Static | Binary/hex converter |
| Math | `complex-plane` | Static | Julia sets visualization |
| Math | `fourier-visualizer` | Static | FFT decomposition |
| Math | `graphing-calculator` | Static | Plot functions |
| Math | `linear-solver` | Static | Solve linear equations |
| Math | `matrix-calculator` | Static | Matrix operations |
| AI | `token-counter` | Static | Count tokens |
| AI | `context-packer` | Static | Pack context for LLMs |
| Tools | `aspect-ratio` | Static | Image dimension calculator |
| Tools | `countdown-timer` | Static | Countdown to date |
| Tools | `dna-helix` | Static | 3D DNA visualization |
| Tools | `timezone-converter` | Static | Time zones |
| Tools | `word-counter` | Static | Count words |
| Tools | `cv-builder` | Static | Upload, clean, export PDF |

**Static** = static HTML/CSS/JS (no repo `package.json` deps for these). URL pattern: **`/{slug}/`**.

---

## Hub catalog — lab / WIP (`WIP_TOOLS`)

Grid-only on homepage; **not** first-class linked cards. **`surface`** is the badge type from [`main/main.js`](main/main.js) (implementation may differ — open folder only when scoped).

| Slug | Surface | Summary |
|------|---------|---------|
| `api-tester` | Web | Test and debug API endpoints |
| `ascii-art` | Web | Generate ASCII art from text |
| `auto-prompter` | Web | Prompt chaining and automation |
| `markdown-preview` | Web | Live markdown editor and preview |
| `prompt-tester` | Web | Test and compare AI prompts |
| `text-summarizer` | Web | Summarize text with AI |
| `audio-visualizer` | Web | Real-time audio visualization |
| `cache-cleaner` | Web | Browser cache management tool |
| `conway-game` | Web | Cellular automaton simulator |
| `fake-data-gen` | Web | Generate realistic test data |
| `git-helper` | Web | Git commands and workflow assistant |
| `llm-cost-tracker` | Web | Track and estimate AI API spending |
| `lorenz-attractor` | Web | Chaos theory 3D visualizer |
| `maze-master` | Web | Maze generation and pathfinding |
| `md2html` | Web | Markdown to HTML converter |
| `mini-agents` | Web | Lightweight AI agent runner |
| `qr-generator` | Web | Generate and style QR codes |
| `secure-vault` | Web | Encrypted local password vault |
| `seo-intel` | Web | SEO analysis and keyword insights |
| `system-health` | Web | Monitor system performance metrics |
| `typing-test` | Web | WPM speed and accuracy test |
| `backup-mirror` | PowerShell | Sync and mirror file backups |
| `cpu-benchmark` | PowerShell | Measure and compare CPU performance |
| `disk-space-health` | PowerShell | Visualise and monitor disk usage |
| `git-worktree` | Shell | Manage multiple git worktrees |
| `rsa-keygen` | Rust | Generate RSA key pairs locally |

*`markdown-preview` and `audio-visualizer` also appear in **live** `TOOLS`; duplicated on the lab grid by design.*

---

## Root folders outside these tables

Treat as **unknown / experimental** until the user points at them (e.g. `pomodoro-timer`, `fluid-sim`, `particle-galaxy`, `contract-generator`).

---

## Monolith map (`main/`)

| Area | Path | Notes |
|------|------|--------|
| Hub UI | [`main/index.html`](main/index.html), [`main/main.js`](main/main.js), [`main/style.css`](main/style.css) | Source; flatten copies these three to repo root for deploy |
| Facts (JSON) | [`main/content/`](main/content/) | **Single source of truth** — hub loads **`main/content/*.json`** |
| Reference HTML | [`main/reference/`](main/reference/) | **Generated** — run `node main/main.js`; do not hand-edit as master |
| Images / shared CSS | [`main/assets/`](main/assets/) | Served at **`/main/assets/...`** |
| Build scripts | [`main/scripts/`](main/scripts/) | `flatten-main.cjs`, `extract-diagram-map.cjs` |
| Tool scaffold | [`main/tool-template/`](main/tool-template/) | Dev-only; not flattened |
| Extra hub UI | [`main/content-suite/`](main/content-suite/) | Keep front-end experiments here |

- **OOO:** each shipped tool is **`{slug}/`** at repo root — **not** inside `main/`.
- **npm:** [`package.json`](package.json) has **no** `dependencies`; scripts only run Node for regen + flatten.
