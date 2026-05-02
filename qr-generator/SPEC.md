# QR Code Generator - Project Specification

## Overview
A ultra-lightweight, mobile-first QR code generator web app. Users enter text/URL, get instant QR code, download it. Simple, fast, friendly. No accounts, no tracking, no bloat.

---

## Core Features

### 1. Text Input
- Single text input field (placeholder: "Enter text, URL, or email")
- Real-time QR generation as user types
- Character counter (max 2953 chars - QR limit)
- Clear button (× icon)

### 2. QR Code Display
- Large, centered QR code
- Shows immediately after typing
- White background with dark code
- Smooth fade-in animation

### 3. Download Options
- **Download as PNG** (primary button)
- **Copy to Clipboard** (secondary button)
- Filename: `qr-code.png` (auto-generated)

### 4. Customization (Optional, Phase 2)
- QR Code size (small/medium/large)
- Error correction level (Low/Medium/High/Very High)
- Color picker (primary color only - dark & light backgrounds)

---

## Tech Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Mobile-first, responsive (no framework)
- **Vanilla JavaScript** - No jQuery, minimal dependencies
- **QR Library** - `qrcode.js` (21KB, gzipped ~6KB)

### No Backend Needed
- 100% client-side processing
- Works offline after load
- No API calls, no servers, no data storage

---

## UI/UX Design

### Layout
```
[Header: "Quick QR"]
[Input field]
[Character counter: X/2953]
[QR Code Display Area]
[Download PNG Button]
[Copy Button]
[Footer: "Private • Fast • Free"]
```

### Mobile-First Breakpoints
- **Mobile** (< 640px): Full-width, single column, 16px padding
- **Tablet** (640px - 1024px): Slightly larger QR, comfortable spacing
- **Desktop** (> 1024px): Max-width 600px, centered

### Colors
- **Background**: Light gray (`#f9f9f9`) or white
- **Primary**: Blue (`#007bff`)
- **Text**: Dark gray (`#333`)
- **Success**: Green (`#28a745`) - for copy feedback
- **Accents**: Light (`#f0f0f0`)

### Typography
- **Font**: System fonts only (`-apple-system, BlinkMacSystemFont, "Segoe UI"`)
- **Heading**: 28px, bold, mobile-friendly
- **Body**: 14-16px, line-height 1.6
- **Mono (for code)**: `Courier New` or monospace

---

## User Flows

### Primary Flow (Mobile)
1. User opens app
2. Focuses input field (keyboard appears)
3. Types text → QR generates in real-time
4. Taps "Download PNG" or "Copy"
5. Done ✓

### Secondary Flow (Copy)
1. User generates QR
2. Taps "Copy to Clipboard"
3. Toast notification: "Copied!" (2 sec fade)
4. Can paste in email, chat, etc.

---

## File Structure
```
qr-generator/
├── index.html        (Main page, semantic markup)
├── style.css         (All styling, mobile-first)
├── script.js         (Logic, event handlers)
├── SPEC.md           (This file)
└── README.md         (Usage instructions)
```

---

## Performance Targets
- **Load time**: < 2 seconds on 4G
- **Bundle size**: < 100KB (HTML + CSS + JS + lib)
- **QR generation**: < 200ms
- **Offline support**: Works completely offline
- **Browser support**: Chrome, Firefox, Safari, Edge (last 2 versions)

---

## Accessibility
- ✓ Semantic HTML (`<input>`, `<button>`, `<label>`)
- ✓ Keyboard navigation (Tab, Enter, Escape)
- ✓ ARIA labels for screen readers
- ✓ Sufficient color contrast (WCAG AA)
- ✓ Focus indicators visible
- ✓ Touch-friendly buttons (min 44px height)

---

## Progressive Enhancement
1. **Base**: Works with HTML + CSS only
2. **Enhanced**: JavaScript for real-time QR
3. **Nice-to-have**: Copy button, animations

---

## Deployment
- Static hosting (GitHub Pages, Vercel, Netlify)
- Single domain (e.g., `qrgen.app`)
- HTTPS only
- Service Worker for offline support (optional, Phase 2)

---

## Success Metrics (Optional)
- Generate QR in < 500ms
- 90%+ user completion (input → download)
- Works on mobile browsers (iOS Safari, Chrome Android)
- Accessibility score: 90+

---

## Future Ideas (Phase 2+)
- Batch QR generation
- Wi-Fi QR codes
- vCard / Contact QR
- Custom branding / logo in QR center
- History (localStorage)
- QR code reader
- Dark mode
- Multiple language support

---

## Notes
- **Privacy**: No data sent anywhere. No analytics. No cookies (except clipboard feedback).
- **Simplicity First**: Each feature must justify its existence.
- **Mobile Sacred**: Test on iPhone 12 / Samsung Galaxy A12 first.
- **No Clutter**: Every pixel earns its place.

---

**Status**: Ready for Development ✓
