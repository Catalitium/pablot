# word-count-lite

Quickstart: Open `index.html`, type or paste text, watch live counts/readability/keywords, copy stats or text.

## Features
- Mobile-first layout with accessible labels, aria-live confirmations, and feature-flagged panels for progress bars, keywords, and optional theme toggle hooks.
- Real-time counts (words, characters, sentences, paragraphs) plus reading-time estimate, naive Flesch/FK readability, and warnings when passing targets (1,200 words / 8,000 chars).
- Keyword insights exclude stopwords, surface top repeats, and optionally render a highlight preview (auto-disabled past 50k characters to protect performance).
- Copy helpers send either the computed stats JSON or the raw text to your clipboard; both emit polite status cues for screen readers.
- Input guard trims everything past 200k characters with a visible banner so the UI stays responsive even on very long drafts.

## Deploy to Netlify
1. **Drag-and-drop:** Zip the repo (or just the three files) and upload at https://app.netlify.com/drop.
2. **GitHub + Netlify:** Push to GitHub, create a new Netlify site from that repo, and keep the default build command/dir (none / root). Every push to `main` redeploys automatically.

## Privacy
All analysis runs locally in your browser. No text leaves your device, no analytics scripts, and no external APIs.

## Sample text
```
Despite steady rain, the crew pushed ahead. Sensors hummed, notebooks filled, and the river kept pacing toward the bay.
```

## Testing checklist
- Empty input → all counters show zero, no console errors.
- Paste ~150k characters → truncation notice appears, typing remains responsive.
- Copy stats/text buttons populate the clipboard with JSON/raw content.
- Readability cards show numbers for multi-sentence paragraphs; blanks stay as `--`.
- Keyword list omits stopwords and updates case-insensitively.
