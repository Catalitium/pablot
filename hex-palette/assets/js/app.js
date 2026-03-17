// --- DOM Elements ---
const primaryColorInput = document.getElementById('primary-color');
const secondaryColorInput = document.getElementById('secondary-color');
const primaryHexInput = document.getElementById('primary-hex');
const secondaryHexInput = document.getElementById('secondary-hex');
const paletteDisplay = document.getElementById('palette-display');
const copyCssBtn = document.getElementById('copy-css-btn');
const contrastResult = document.getElementById('contrast-result');
const toast = document.getElementById('toast');
const targetedRandomButtons = document.querySelectorAll('[data-randomize]');
const moodButtons = document.querySelectorAll('[data-mood]');
const moodIndicator = document.getElementById('mood-indicator');

// --- Color Utilities ---
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function getLuminance(rgb) {
  const a = [rgb.r, rgb.g, rgb.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

function getContrastRatio(hex1, hex2) {
  const l1 = getLuminance(hexToRgb(hex1));
  const l2 = getLuminance(hexToRgb(hex2));
  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return Math.round(ratio * 10) / 10;
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToHsl(hex) {
  const { r, g, b } = hexToRgb(hex);
  let rr = r / 255, gg = g / 255, bb = b / 255;
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rr: h = (gg - bb) / d + (gg < bb ? 6 : 0); break;
      case gg: h = (bb - rr) / d + 2; break;
      default: h = (rr - gg) / d + 4;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const DEFAULT_MOOD = 'calm';
let currentMood = DEFAULT_MOOD;

const moodPalettes = {
  calm:  { label: 'Calm Drift',   emoji: 'ã€°ï¸', primary: '#5468ff', secondary: '#bfe0ff' },
  noir:  { label: 'Night Grid',   emoji: 'â—¼ï¸', primary: '#0b1116', secondary: '#f5eddc' },
  bloom: { label: 'Bloom Pop',    emoji: 'âœ¿', primary: '#f2547d', secondary: '#ffd9e8' },
  solar: { label: 'Solar Flash',  emoji: 'âš¡', primary: '#ff6b00', secondary: '#ffe4a0' },
  fresh: { label: 'Fresh Cut',    emoji: 'âœ³ï¸', primary: '#1fbf8f', secondary: '#d9ffe5' }
};

function generateVariantFromHex(hex) {
  const base = hexToHsl(hex);
  const lightShift = Math.random() > 0.5 ? randomInRange(12, 20) : randomInRange(-20, -12);
  const saturationShift = Math.random() > 0.5 ? randomInRange(-8, 8) : randomInRange(6, 14) * (lightShift > 0 ? -1 : 1);
  const newLightness = clamp(base.l + lightShift, 5, 95);
  const newSaturation = clamp(base.s + saturationShift, 10, 95);
  return hslToHex(base.h, newSaturation, newLightness);
}

function setActiveMoodButton(activeKey) {
  moodButtons.forEach(button => {
    const isActive = button.dataset.mood === activeKey;
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}

function applyMood(moodKey, announce = true) {
  const mood = moodPalettes[moodKey] || moodPalettes[DEFAULT_MOOD];
  currentMood = moodKey in moodPalettes ? moodKey : DEFAULT_MOOD;

  syncColorInputs('primary', mood.primary);
  syncColorInputs('secondary', mood.secondary);
  updateUI();
  setActiveMoodButton(currentMood);

  if (moodIndicator) {
    moodIndicator.textContent = `${mood.emoji} ${mood.label}`;
  }

  if (announce) {
    showToast(`${mood.label} mood applied`);
  }
}

function syncColorInputs(type, hex) {
  if (type === 'primary') {
    primaryHexInput.value = hex;
    primaryColorInput.value = hex;
  } else {
    secondaryHexInput.value = hex;
    secondaryColorInput.value = hex;
  }
}

// --- Main Logic ---
function generatePalette(primaryHex, secondaryHex) {
  const p = hexToHsl(primaryHex);
  const s = hexToHsl(secondaryHex);

  const primaryLighter = hslToHex(p.h, p.s, Math.min(100, p.l + 15));
  const primaryDarker  = hslToHex(p.h, p.s, Math.max(10,  p.l - 20));
  const secondaryLighter = hslToHex(s.h, s.s, Math.min(100, s.l + 15));
  const secondaryDarker  = hslToHex(s.h, s.s, Math.max(10,  s.l - 20));

  const neutralH = Math.round((p.h + s.h) / 2) % 360;
  const neutral  = hslToHex(neutralH, 5, 95);

  return [
    { name: 'Primary',     hex: primaryHex,     desc: 'Base Color' },
    { name: 'Primary-L',   hex: primaryLighter, desc: 'Light Tint' },
    { name: 'Primary-D',   hex: primaryDarker,  desc: 'Dark Shade' },
    { name: 'Secondary',   hex: secondaryHex,   desc: 'Accent Color' },
    { name: 'Secondary-L', hex: secondaryLighter, desc: 'Light Accent Tint' },
    { name: 'Neutral',     hex: neutral,        desc: 'Background/Base' }
  ];
}

function updateUI() {
  const primaryHex = primaryHexInput.value.toLowerCase();
  const secondaryHex = secondaryHexInput.value.toLowerCase();

  if (!/^#[0-9a-f]{6}$/.test(primaryHex) || !/^#[0-9a-f]{6}$/.test(secondaryHex)) {
    contrastResult.textContent = 'Waiting for valid hex.';
    paletteDisplay.innerHTML = '';
    return;
  }

  const palette = generatePalette(primaryHex, secondaryHex);
  let html = '';
  let cssVariables = ':root {\n';

  palette.forEach(p => {
    const isDark = hexToHsl(p.hex).l < 50;
    const textColor = isDark ? '#ffffff' : '#000000';

    html += `
      <div class="color-swatch-cell h-32 sm:h-40 flex flex-col justify-between p-4 uppercase tracking-[0.2em]" style="background-color: ${p.hex}; color: ${textColor};" role="listitem" aria-label="${p.name} swatch ${p.hex}">
        <span class="text-xs">${p.name}</span>
        <span class="text-2xl sm:text-3xl font-black tracking-tight">${p.hex}</span>
        <span class="text-[10px]">${p.desc}</span>
      </div>
    `;

    cssVariables += `  --color-${p.name.toLowerCase().replace('-', '_')}: ${p.hex};\n`;
  });

  paletteDisplay.innerHTML = html;

  cssVariables += '}';
  copyCssBtn.dataset.css = cssVariables;

  const primaryText = palette.find(p => p.name === 'Primary').hex;
  const neutralBg   = palette.find(p => p.name === 'Neutral').hex;
  const ratio = getContrastRatio(primaryText, neutralBg);
  const isPassing = ratio >= 4.5;

  contrastResult.textContent = `Ratio ${ratio}:1 / ${isPassing ? 'PASS AA' : 'FAIL AA'} / primary on neutral`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 3000);
}

// --- Events & Init ---
[primaryColorInput, secondaryColorInput].forEach(input => {
  input.addEventListener('input', (e) => {
    const targetHexInput = e.target.id.includes('primary') ? primaryHexInput : secondaryHexInput;
    targetHexInput.value = e.target.value;
    updateUI();
  });
});

[primaryHexInput, secondaryHexInput].forEach(input => {
  input.addEventListener('input', (e) => {
    const targetColorInput = e.target.id.includes('primary') ? primaryColorInput : secondaryColorInput;
    if (/^#[0-9a-f]{6}$/.test(e.target.value.toLowerCase())) {
      targetColorInput.value = e.target.value;
      updateUI();
    }
  });
});

targetedRandomButtons.forEach(button => {
  button.addEventListener('click', () => {
    const target = button.dataset.randomize;
    const referenceHex = target === 'primary' ? secondaryHexInput.value : primaryHexInput.value;
    const validRef = /^#[0-9a-f]{6}$/.test(referenceHex.toLowerCase());
    const paletteFallback = moodPalettes[currentMood] || moodPalettes[DEFAULT_MOOD];
    const fallbackHex = paletteFallback[target === 'primary' ? 'primary' : 'secondary'];
    const nextHex = validRef ? generateVariantFromHex(referenceHex.toLowerCase()) : fallbackHex;

    syncColorInputs(target, nextHex);
    updateUI();
    showToast(`Linked ${target} hue`);
  });
});

moodButtons.forEach(button => {
  button.addEventListener('click', () => {
    const moodKey = button.dataset.mood || DEFAULT_MOOD;
    applyMood(moodKey);
  });
});

copyCssBtn.addEventListener('click', () => {
  const css = copyCssBtn.dataset.css;
  if (css && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(css)
      .then(() => showToast('CSS variables copied to clipboard!'))
      .catch(() => showToast('Failed to copy.'));
  } else {
    showToast('Clipboard unavailable.');
  }
});

applyMood(DEFAULT_MOOD, false);

