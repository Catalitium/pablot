# CV Builder

## Product

Local-only CV cleanup: upload PDF/DOCX/TXT, review a **Harvard-style** HTML layout, save PDF via the **browser print dialog** (same layout as the preview—no second PDF engine).

## Template

Reference: `template/2026-template_bullet.docx`. Tokens live in `template-config.js` and CSS variables in `style.css` (`--cv-name-size`, `--cv-body-size`, etc.).

**Section order:** configurable (Education first vs Experience first) to match student vs professional resumes.

## Architecture

| File | Role |
|------|------|
| `index.html` | Upload ribbon, document hero (`#cvPreview`), collapsible edit panels |
| `style.css` | UI + `.cv-doc` print styles |
| `template-config.js` | Section order arrays |
| `main.js` | `state` with `rawExtracted`, normalized fields, `ui.phase`; **single** `renderCvDocument()` for preview and print |
| `template/` | Reference DOCX (not loaded at runtime) |

**PDF export:** `window.print()` → “Save as PDF”. Procedural jsPDF removed so preview and export cannot drift.

## Scripts

- pdf.js — PDF text extraction  
- mammoth — DOCX text extraction  

No build step.
