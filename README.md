# Pablot

Static hub at **`/`**, **`/{slug}/`** tool apps on the **repo root**, and editable hub product under **`main/`**. **OOO** = shipped tools stay **out of** `main/` (layout in **Monolith map**).

**Support / incidents:** hub tool lists are authoritative in [`main/main.js`](main/main.js) (`TOOLS`, `WIP_TOOLS`). Run **`npm run build`** to regenerate **`main/reference/`** HTML from the embedded dataset in that file (`node main/main.js`). If your checkout includes flatten scripts, run the full **`build`** chain so [`main/index.html`](main/index.html), [`main/main.js`](main/main.js), and [`main/style.css`](main/style.css) are copied to the repo root for deploy. Deploy: [`netlify.toml`](netlify.toml) uses **`publish = "."`** and redirects **`/content/*`**, **`/reference/*`**, **`/assets/*`** → **`/main/...`** where applicable. Legacy **`/qr-code`** URLs **301** to **`/qr-generator/`** (single canonical QR tool). **`npm run build`** also writes **[`sitemap.xml`](sitemap.xml)** at the repo root from **`TOOLS`** + reference routes; **[`robots.txt`](robots.txt)** points crawlers at it.

The lab grid mixes stacks (`Python`, `Flask`, shells, etc.); **`surface`** in the WIP table below matches the badge string in **`main/main.js`**, not “always static HTML”.

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
| Code | `lorem-generator` | Static | Placeholder text |
| Code | `api-tester` | Static | HTTP requests from the browser |
| Code | `ascii-table` | Static | ASCII / hex reference |
| Design | `color-scheme` | Static | Generate palettes |
| Design | `gradient-generator` | Static | CSS gradients |
| Design | `hex-palette` | Static | Color palette |
| Design | `social-card` | Static | Design social cards |
| Design | `generative-art` | Static | Mathematical art generation |
| Design | `audio-visualizer` | Static | Realtime audio FFT |
| Design | `qr-generator` | Static | Generate QR codes |
| Design | `color-mixer` | Static | Blend hex colors |
| Data | `base64` | Static | Encode/decode Base64 |
| Data | `binary-converter` | Static | Binary/hex converter |
| Math | `complex-plane` | Static | Julia sets visualization |
| Math | `conway-game` | Static | Cellular automaton simulator |
| Math | `fourier-visualizer` | Static | FFT decomposition |
| Math | `graphing-calculator` | Static | Plot functions |
| Math | `linear-solver` | Static | Solve linear equations |
| Math | `matrix-calculator` | Static | Matrix operations |
| Math | `lorenz-attractor` | Static | Chaos 3D visualization |
| Math | `solar-system` | Static | Orbital visualization |
| AI | `token-counter` | Static | Count tokens |
| AI | `context-packer` | Static | Pack context for LLMs |
| AI | `prompt-tester` | Static | Compare prompts locally |
| AI | `auto-prompter` | Static | Chain prompts locally |
| AI | `text-summarizer` | Static | Summarize text locally |
| Tools | `aspect-ratio` | Static | Image dimension calculator |
| Tools | `countdown-timer` | Static | Countdown to date |
| Tools | `dna-helix` | Static | 3D DNA visualization |
| Tools | `system-health` | Static | Browser and machine diagnostics |
| Tools | `timezone-converter` | Static | Time zones |
| Tools | `word-counter` | Static | Count words |
| Tools | `cv-builder` | Static | Upload, clean, export PDF |
| Tools | `pomodoro-timer` | Static | Focus intervals |
| Tools | `reading-estimator` | Static | Reading time estimate |
| Tools | `typing-test` | Static | WPM speed and accuracy |
| Tools | `epoch-converter` | Static | Unix time and locale dates |
| Tools | `password-generator` | Static | Random passwords |

Promoted from lab to the AI tab: `prompt-tester`, `auto-prompter`, `text-summarizer`.

**Static** = static HTML/CSS/JS (no repo `package.json` deps for these). URL pattern: **`/{slug}/`**.

---

## Hub catalog — lab / WIP (`WIP_TOOLS`)

Grid-only on homepage; **not** first-class linked cards. **`surface`** is the badge type from [`main/main.js`](main/main.js).

| Slug | Surface | Summary |
|------|---------|---------|
| `ascii-art` | Web | Generate ASCII art from text |
| `pdf-summarizer` | Web | Extract and summarize PDF content in-browser |
| `image-analyzer` | Web | Inspect images with captions and metadata locally |
| `code-explainer` | Web | Explain snippets or files without leaving the tab |
| `meeting-notes-cleaner` | Web | Structure and clean raw meeting notes |
| `url-shortener` | Web | Shorten URLs client-side or via static mapping |
| `cache-cleaner` | Web | Browser cache management tool |
| `fake-data-gen` | Web | Generate realistic test data |
| `git-helper` | Web | Git commands and workflow assistant |
| `llm-cost-tracker` | Web | Track and estimate AI API spending |
| `maze-master` | Web | Maze generation and pathfinding |
| `md2html` | Python | Markdown to HTML converter |
| `mini-agents` | Python | Lightweight AI agent runner |
| `secure-vault` | Web | Encrypted local password vault |
| `seo-intel` | Flask | SEO analysis and keyword insights |
| `backup-mirror` | PowerShell | Sync and mirror file backups |
| `cpu-benchmark` | PowerShell | Measure and compare CPU performance |
| `disk-space-health` | PowerShell | Visualise and monitor disk usage |
| `git-worktree` | Shell | Manage multiple git worktrees |
| `rsa-keygen` | Rust | Generate RSA key pairs locally |

---

## Contributing a new tool

- Copy [`main/tool-template/index.html`](main/tool-template/index.html) into a new repo-root folder **`{slug}/`**, then rename paths: hub link **`href="../"`**, local **`style.css`** / **`script.js`** as needed.
- Include **`charset`**, **`viewport`**, **`title`**, **`meta name="description"`**, and a visible **back link** to the hub.
- Keep it **static** (no secrets, no backend); prefer zero CDN unless an existing tool pattern requires it.
- Register the tool in **`TOOLS`** (and summary row in this README **live** table). Use **`WIP_TOOLS`** only until there is a solid root **`index.html`**.

---

## Root folders outside these tables

Treat as **unknown / experimental** until the user points at them (e.g. `fluid-sim`, `particle-galaxy`, `contract-generator`).

---

## Monolith map (`main/`)

| Area | Path | Notes |
|------|------|--------|
| Hub UI | [`main/index.html`](main/index.html), [`main/main.js`](main/main.js), [`main/style.css`](main/style.css) | Source of hub; copy/f flatten to repo root when your pipeline requires it |
| Facts (JSON) | [`main/content/`](main/content/) | Used for reference/tooling pipelines — **not** loaded at runtime by the hub (`TOOLS` / galleries are embedded in [`main/main.js`](main/main.js)) |
| Reference HTML | [`main/reference/`](main/reference/) | Regenerate with **`node main/main.js`** (see top of that file); avoid hand-editing as master |
| Images / shared CSS | [`main/assets/`](main/assets/) | Served at **`/main/assets/...`** |
| Tool scaffold | [`main/tool-template/`](main/tool-template/) | Dev-only template for new root tools |
| Extra hub UI | [`main/content-suite/`](main/content-suite/) | Keep front-end experiments here |

- **OOO:** each shipped tool is **`{slug}/`** at repo root — **not** inside `main/`.
- **npm:** [`package.json`](package.json) has **no** `dependencies`; **`npm run build`** runs `node main/main.js`; **`npm run flatten`** copies hub files to the repo root when you need them aligned with `main/`.
