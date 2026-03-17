# Color Scheme Palette Generator

Offline palette generator for random color sets with lock controls and export tools.

## Features
- Generates a 5-color random palette.
- Per-color lock state:
  - Locked colors stay unchanged during regenerate.
  - Unlocked colors are regenerated.
- Copy operations:
  - Copy single hex values.
  - Copy full CSS variable export.
  - Copy JSON export payload.
- Download exports:
  - `color-scheme-palette.css`
  - `color-scheme-palette.json`

## Export Formats
- CSS output:
  - `:root` block with `--palette-color-1` to `--palette-color-5`.
- JSON output:
  - Array of palette entries with `index`, `hex`, and `locked`.

## Clipboard Behavior
- Uses `navigator.clipboard` in secure contexts.
- Falls back to temporary textarea + `execCommand("copy")` when the Clipboard API is unavailable.
- Some browsers on insecure contexts can still block fallback copy.

## Local Run
Open `index.html` in any modern browser. No server, build step, or external dependency is required.
