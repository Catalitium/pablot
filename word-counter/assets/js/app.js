(() => {
  'use strict';

  /**
   * Feature flags keep optional UI panels behind simple switches.
   * Flip to false during experiments to isolate perf or UX work.
   */
  const FEATURE_KEYWORDS_PANEL = true;
  const FEATURE_PROGRESS_BARS = true;
  const FEATURE_COPY_STATS_JSON = true;
  const FEATURE_COPY_TEXT = true;
  const FEATURE_READABILITY = true;
  const FEATURE_THEME_TOGGLE = true;

  /** Tunable targets and limits */
  const TARGET_WORDS = 1200;
  const TARGET_CHARS = 8000;
  const READING_WPM = 200;
  const INPUT_MAX_CHARS = 200000;
  const PREVIEW_CHAR_LIMIT = 50000;
  const SYLLABLE_CAP = 250000;

  /**
   * Stopword list (~150 entries) keeps keyword output meaningful.
   * All lowercase to simplify comparisons without locale overhead.
   */
  const STOPWORDS = new Set([
    'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren', 'as',
    'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'cannot',
    'could', 'couldn', 'did', 'didn', 'do', 'does', 'doesn', 'doing', 'don', 'down', 'during', 'each', 'few',
    'for', 'from', 'further', 'had', 'hadn', 'has', 'hasn', 'have', 'haven', 'having', 'he', 'her', 'here',
    'hers', 'herself', 'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn', 'it', 'its',
    'itself', 'just', 'll', 'm', 'ma', 'me', 'might', 'more', 'most', 'must', 'mustn', 'my', 'myself',
    'needn', 'no', 'nor', 'not', 'now', 'o', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our', 'ours',
    'ourselves', 'out', 'over', 'own', 're', 's', 'same', 'shan', 'she', 'should', 'shouldn', 'so', 'some',
    'such', 't', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these',
    'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn', 'we',
    'were', 'weren', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'will', 'with', 'won',
    'would', 'wouldn', 'y', 'you', 'your', 'yours', 'yourself', 'yourselves', 'yet', 'ain', 'd', 'hadn',
    'hasnt', 'havent', 'isnt', 'shouldnt', 'wasnt', 'werent', 'wont', 'wouldnt', 'herein', 'hereby', 'therein',
    'thereby', 'wherein', 'whereby', 'cant', 'couldnt', 'dont', 'doesnt', 'didnt', 'im', 'ive', 'youre',
    'youve', 'weve', 'theyre', 'theyve', 'lets', 'us', 'ourselves', 'hers', 'himself', 'whichever', 'whoever',
    'whomever', 'yall', 'ain\'t', 'shan\'t', 'tis', 'twas', 'unto', 'versus', 'vs', 'per', 'via', 'upon'
  ]);

  /**
   * Performance notes:
   * - Input updates debounce to 180 ms to keep typing smooth.
   * - Input hard-caps at 200k chars; extra data is truncated with a visible notice.
   * - Preview highlights skip once input > 50k chars to avoid heavy regex/DOM work.
   * - Syllable accumulation halts at 250k to guard against runaway loops.
   */

  const ABBREVIATIONS = new Set([
    'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'etc', 'ie', 'eg', 'vs', 'st', 'rd', 'co', 'inc'
  ]);

  const defaultCounts = () => ({
    words: 0,
    chars: 0,
    charsNoSpace: 0,
    sentences: 0,
    paragraphs: 0
  });

  const state = {
    text: '',
    counts: defaultCounts(),
    syllables: 0,
    keywords: [],
    readingTime: { minutes: 0, seconds: 0 },
    readability: { fre: null, fkgl: null }
  };

  /* ----------------------------------------------------------
   * Utilities
   * -------------------------------------------------------- */

  const debounce = (fn, delay = 180) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };

  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

  const percent = (value, target) => {
    if (!target) return 0;
    return clamp(Math.round((value / target) * 100), 0, 300);
  };

  const safeText = (input = '') =>
    (input || '').replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

  const isLetter = (char = '') => /^[a-z]$/i.test(char);

  const splitParagraphs = (text = '') => {
    const normalized = text.replace(/\r/g, '\n');
    const parts = normalized
      .split(/\n{2,}|\n\s*\n/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);
    if (!parts.length && text.trim()) return [text.trim()];
    return parts;
  };

  /**
   * Naive sentence splitter: looks for punctuation boundaries,
   * skipping a short abbreviation list to reduce over-splitting.
   * Acceptable tradeoff for MVP; documented in README.
   */
  const splitSentences = (text = '') => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    const pieces = trimmed.split(/(?<=[.!?])\s+/);
    const sentences = [];
    let buffer = '';

    pieces.forEach((piece) => {
      const segment = piece.trim();
      if (!segment) return;
      buffer = buffer ? `${buffer} ${segment}` : segment;
      const tail = segment.split(/\s+/).pop() || '';
      const lowerTail = tail.replace(/[^a-z.]/gi, '').toLowerCase();
      const looksLikeAbbrev =
        ABBREVIATIONS.has(lowerTail.replace(/\./g, '')) ||
        /[a-z]\.[a-z]\.$/.test(lowerTail); // guards i.e., e.g.
      if (/[.!?]"?$/.test(segment) && !looksLikeAbbrev) {
        sentences.push(buffer.trim());
        buffer = '';
      }
    });

    if (buffer) sentences.push(buffer.trim());
    return sentences;
  };

  const tokenize = (text = '') =>
    text
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 2 && !STOPWORDS.has(word));

  const escapeHtml = (str = '') =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const escapeRegex = (str = '') => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  /* ----------------------------------------------------------
   * Syllable heuristics (fast + deterministic)
   * -------------------------------------------------------- */

  const vowelGroupRegex = /[aeiouy]+/g;

  /**
   * Heuristic syllable counter examples (documented for clarity):
   * - "table" → 2
   * - "rhythm" → 1
   * - "beautiful" → 3
   * - "queue" → 1
   */
  const countSyllablesWord = (word = '') => {
    const lower = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!lower) return 0;
    if (lower.length <= 3) return 1;

    let working = lower.replace(/(?:ed|es)$/g, '');
    if (working.endsWith('e') && !working.endsWith('le')) {
      working = working.slice(0, -1);
    }

    const groups = working.match(vowelGroupRegex);
    const syllables = groups ? groups.length : 0;
    return Math.max(1, syllables);
  };

  const countSyllablesText = (tokens = []) => {
    let total = 0;
    for (const word of tokens) {
      total += countSyllablesWord(word);
      if (total >= SYLLABLE_CAP) return SYLLABLE_CAP;
    }
    return total;
  };

  /* ----------------------------------------------------------
   * Metrics + helpers
   * -------------------------------------------------------- */

  const computeCounts = (text = '') => {
    const trimmed = text.trim();
    const tokens = tokenize(trimmed);
    const sentences = splitSentences(trimmed);
    const paragraphs = splitParagraphs(trimmed);

    return {
      tokens,
      words: tokens.length,
      chars: text.length,
      charsNoSpace: text.replace(/\s+/g, '').length,
      sentences: sentences.length,
      paragraphs: paragraphs.length
    };
  };

  const computeReadingTime = (words, wpm) => {
    if (!words) return { minutes: 0, seconds: 0 };
    const totalSeconds = Math.ceil((words / wpm) * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  };

  const computeReadability = (words, sentences, syllables) => {
    if (!words || !sentences || !syllables) {
      return { fre: null, fkgl: null };
    }
    const avgSentence = words / sentences;
    const avgSyllables = syllables / words;
    const fre = 206.835 - 1.015 * avgSentence - 84.6 * avgSyllables;
    const fkgl = 0.39 * avgSentence + 11.8 * avgSyllables - 15.59;
    return { fre: fre.toFixed(1), fkgl: fkgl.toFixed(1) };
  };

  const buildFreq = (tokens = []) => {
    const freq = new Map();
    tokens.forEach((word) => {
      freq.set(word, (freq.get(word) || 0) + 1);
    });
    return freq;
  };

  const topKeywords = (freqMap, limit = 10, totalWords = 1) => {
    const entries = Array.from(freqMap.entries())
      .map(([word, count]) => ({
        word,
        count,
        pct: ((count / Math.max(totalWords, 1)) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
    return entries;
  };

  const highlightPreview = (text = '', keywords = []) => {
    if (!text) return '';
    if (text.length > PREVIEW_CHAR_LIMIT) {
      return null; // signal to caller to skip heavy markup
    }
    const safe = escapeHtml(text);
    const words = keywords.slice(0, 5).map((item) => item.word);
    if (!words.length) return safe;
    const regex = new RegExp(`\\b(${words.map(escapeRegex).join('|')})\\b`, 'gi');
    return safe.replace(
      regex,
      (match) =>
        `<mark class="rounded bg-amber-300/70 px-1 text-slate-900">${match}</mark>`
    );
  };

  const computeProgress = (current, target) => {
    const value = percent(current, target);
    return {
      value,
      over: current > target,
      delta: current - target
    };
  };

  const buildStatsObject = () => ({
    words: state.counts.words,
    chars: state.counts.chars,
    charsNoSpace: state.counts.charsNoSpace,
    sentences: state.counts.sentences,
    paragraphs: state.counts.paragraphs,
    readingTime: state.readingTime,
    readability: state.readability,
    topKeywords: state.keywords,
    timestamp: new Date().toISOString()
  });

  /* ----------------------------------------------------------
   * DOM wiring
   * -------------------------------------------------------- */

  const elements = {
    textarea: document.getElementById('inputText'),
    analyzeBtn: document.getElementById('analyzeBtn'),
    resetBtn: document.getElementById('resetBtn'),
    copyStatsBtn: document.getElementById('copyStatsBtn'),
    copyTextBtn: document.getElementById('copyTextBtn'),
    truncationNotice: document.getElementById('truncationNotice'),
    liveRegion: document.getElementById('statusLive'),
    wordsValue: document.getElementById('wordsValue'),
    charsValue: document.getElementById('charsValue'),
    charsNoSpaceValue: document.getElementById('charsNoSpaceValue'),
    sentencesValue: document.getElementById('sentencesValue'),
    paragraphsValue: document.getElementById('paragraphsValue'),
    readingTimeValue: document.getElementById('readingTimeValue'),
    fleschValue: document.getElementById('fleschValue'),
    fkglValue: document.getElementById('fkglValue'),
    progressSection: document.getElementById('progressSection'),
    wordProgressBar: document.getElementById('wordProgressBar'),
    wordProgressLabel: document.getElementById('wordProgressLabel'),
    wordProgressWarning: document.getElementById('wordProgressWarning'),
    charProgressBar: document.getElementById('charProgressBar'),
    charProgressLabel: document.getElementById('charProgressLabel'),
    charProgressWarning: document.getElementById('charProgressWarning'),
    keywordsSection: document.getElementById('keywordsSection'),
    keywordList: document.getElementById('keywordList'),
    previewPanel: document.getElementById('previewPanel'),
    previewToggle: document.getElementById('previewToggle'),
    previewNotice: document.getElementById('previewNotice'),
    themeToggle: document.getElementById('themeToggle')
  };

  const announce = (message) => {
    if (!elements.liveRegion) return;
    elements.liveRegion.textContent = message;
  };

  const setHidden = (el, hidden) => {
    if (!el) return;
    el.classList.toggle('hidden', hidden);
  };

  const zeroPad = (num) => String(num).padStart(2, '0');

  const renderCounts = (counts) => {
    elements.wordsValue.textContent = counts.words.toLocaleString();
    elements.charsValue.textContent = counts.chars.toLocaleString();
    elements.charsNoSpaceValue.textContent = counts.charsNoSpace.toLocaleString();
    elements.sentencesValue.textContent = counts.sentences.toLocaleString();
    elements.paragraphsValue.textContent = counts.paragraphs.toLocaleString();
  };

  const renderReadingTime = (readingTime) => {
    const { minutes, seconds } = readingTime;
    elements.readingTimeValue.textContent = `${minutes}:${zeroPad(seconds)}`;
  };

  const renderReadability = (readability) => {
    if (!FEATURE_READABILITY) {
      elements.fleschValue.textContent = '--';
      elements.fkglValue.textContent = '--';
      return;
    }
    elements.fleschValue.textContent =
      readability.fre ?? '--';
    elements.fkglValue.textContent =
      readability.fkgl ?? '--';
  };

  const updateProgressUI = (counts) => {
    if (!FEATURE_PROGRESS_BARS || !elements.progressSection) return;

    const wordProgress = computeProgress(counts.words, TARGET_WORDS);
    const charProgress = computeProgress(counts.chars, TARGET_CHARS);

    elements.wordProgressBar.style.width = `${clamp(wordProgress.value, 0, 100)}%`;
    elements.wordProgressBar.classList.toggle(
      'bg-rose-500',
      wordProgress.over
    );
    elements.wordProgressBar.classList.toggle(
      'bg-sky-400',
      !wordProgress.over
    );
    elements.wordProgressBar.parentElement?.setAttribute(
      'aria-valuenow',
      String(clamp(wordProgress.value, 0, 100))
    );
    elements.wordProgressLabel.textContent = `${counts.words.toLocaleString()} / ${TARGET_WORDS.toLocaleString()}`;
    if (wordProgress.over) {
      elements.wordProgressWarning.textContent = `Over target by +${Math.abs(
        wordProgress.delta
      ).toLocaleString()} words`;
      elements.wordProgressWarning.classList.remove('hidden');
    } else {
      elements.wordProgressWarning.classList.add('hidden');
    }

    elements.charProgressBar.style.width = `${clamp(charProgress.value, 0, 100)}%`;
    elements.charProgressBar.classList.toggle(
      'bg-rose-500',
      charProgress.over
    );
    elements.charProgressBar.classList.toggle(
      'bg-sky-400',
      !charProgress.over
    );
    elements.charProgressBar.parentElement?.setAttribute(
      'aria-valuenow',
      String(clamp(charProgress.value, 0, 100))
    );
    elements.charProgressLabel.textContent = `${counts.chars.toLocaleString()} / ${TARGET_CHARS.toLocaleString()}`;
    if (charProgress.over) {
      elements.charProgressWarning.textContent = `Over target by +${Math.abs(
        charProgress.delta
      ).toLocaleString()} characters`;
      elements.charProgressWarning.classList.remove('hidden');
    } else {
      elements.charProgressWarning.classList.add('hidden');
    }
  };

  const renderKeywords = (keywords, totalWords) => {
    if (!FEATURE_KEYWORDS_PANEL) return;
    if (!elements.keywordList) return;
    if (!keywords.length) {
      elements.keywordList.innerHTML =
        '<li class="text-slate-400">Enter text to see keywords.</li>';
      return;
    }

    elements.keywordList.innerHTML = keywords
      .map(
        (item) => `
        <li class="flex items-center justify-between border-b border-white/5 py-1 last:border-none">
          <span class="font-mono text-sm">${item.word}</span>
          <span class="text-xs text-slate-400">${item.count.toLocaleString()} · ${item.pct}%</span>
        </li>`
      )
      .join('');

    elements.keywordList.insertAdjacentHTML(
      'beforeend',
      `<li class="pt-2 text-[11px] uppercase tracking-wide text-slate-500">
        Total keywords: ${totalWords.toLocaleString()}
      </li>`
    );
  };

  const renderPreview = (text, keywords) => {
    if (!FEATURE_KEYWORDS_PANEL || !elements.previewPanel) return;
    const markup = highlightPreview(text, keywords);
    if (markup === null) {
      elements.previewPanel.innerHTML =
        '<p class="text-sm text-slate-400">Preview disabled for large inputs (&gt;50k chars).</p>';
      elements.previewNotice.textContent =
        'Preview skipped to keep huge inputs responsive.';
      return;
    }
    elements.previewPanel.innerHTML =
      markup || '<p class="text-sm text-slate-400">No keywords to highlight yet.</p>';
    elements.previewNotice.textContent =
      'Preview stays hidden by default to keep big inputs fast.';
  };

  const togglePreviewVisibility = () => {
    if (!elements.previewPanel || !elements.previewToggle) return;
    const willShow = elements.previewPanel.classList.contains('hidden');
    elements.previewPanel.classList.toggle('hidden');
    elements.previewToggle.setAttribute('aria-expanded', String(willShow));
    elements.previewToggle.textContent = willShow ? 'Hide preview' : 'Show preview';
  };

  const showTruncationNotice = (visible, originalLength) => {
    if (!elements.truncationNotice) return;
    if (visible) {
      elements.truncationNotice.textContent = `Input capped at ${INPUT_MAX_CHARS.toLocaleString()} characters (trimmed ${(
        originalLength - INPUT_MAX_CHARS
      ).toLocaleString()} extra).`;
      elements.truncationNotice.classList.remove('hidden');
    } else {
      elements.truncationNotice.classList.add('hidden');
    }
  };

  const copyStatsJSON = async () => {
    if (!FEATURE_COPY_STATS_JSON || !navigator.clipboard) return;
    const payload = JSON.stringify(buildStatsObject(), null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      announce('Stats copied as JSON.');
    } catch (err) {
      console.error(err);
      announce('Clipboard blocked. Please grant permission.');
    }
  };

  const copyText = async () => {
    if (!FEATURE_COPY_TEXT || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(state.text);
      announce('Full text copied to clipboard.');
    } catch (err) {
      console.error(err);
      announce('Clipboard blocked. Please grant permission.');
    }
  };

  const applyThemeToggle = () => {
    if (!FEATURE_THEME_TOGGLE || !elements.themeToggle) {
      elements.themeToggle?.classList.add('hidden');
      return;
    }
    elements.themeToggle.classList.remove('hidden');
    const root = document.documentElement;
    const body = document.body;
    const setTheme = (mode) => {
      root.dataset.theme = mode;
      body.dataset.theme = mode;
      elements.themeToggle.textContent =
        mode === 'dark' ? '☀ Light mode' : '☾ Dark mode';
      try { localStorage.setItem('wc-theme', mode); } catch (_) {}
    };
    let current;
    try { current = localStorage.getItem('wc-theme'); } catch (_) {}
    current = current || body.dataset.theme || 'dark';
    setTheme(current);
    elements.themeToggle.addEventListener('click', () => {
      current = current === 'dark' ? 'light' : 'dark';
      setTheme(current);
      announce(`Theme set to ${current}.`);
    });
  };

  const renderDefaults = () => {
    state.text = '';
    state.counts = defaultCounts();
    state.syllables = 0;
    state.keywords = [];
    state.readingTime = { minutes: 0, seconds: 0 };
    state.readability = { fre: null, fkgl: null };
    renderCounts(state.counts);
    renderReadingTime(state.readingTime);
    renderReadability(state.readability);
    updateProgressUI(state.counts);
    renderKeywords([], 0);
    renderPreview('', []);
  };

  const analyzeText = () => {
    if (!elements.textarea) return;
    const rawInput = safeText(elements.textarea.value || '');
    if (!rawInput.trim()) {
      renderDefaults();
      return;
    }

    let workingText = rawInput;
    if (rawInput.length > INPUT_MAX_CHARS) {
      workingText = rawInput.slice(0, INPUT_MAX_CHARS);
      elements.textarea.value = workingText;
      showTruncationNotice(true, rawInput.length);
      announce('Input truncated to keep things fast.');
    } else {
      showTruncationNotice(false);
    }

    const counts = computeCounts(workingText);
    const syllables = countSyllablesText(counts.tokens);
    const readingTime = computeReadingTime(counts.words, READING_WPM);
    const readability = FEATURE_READABILITY
      ? computeReadability(counts.words, counts.sentences || 1, syllables || 1)
      : { fre: null, fkgl: null };
    const freq = buildFreq(counts.tokens);
    const keywords = FEATURE_KEYWORDS_PANEL
      ? topKeywords(freq, 10, counts.words || 1)
      : [];

    state.text = workingText;
    state.counts = counts;
    state.syllables = syllables;
    state.keywords = keywords;
    state.readingTime = readingTime;
    state.readability = readability;

    renderCounts(counts);
    renderReadingTime(readingTime);
    renderReadability(readability);
    updateProgressUI(counts);
    renderKeywords(keywords, counts.tokens.length);
    renderPreview(workingText, keywords);
  };

  const debouncedAnalyze = debounce(analyzeText, 200);

  const init = () => {
    if (!elements.textarea) return;
    applyThemeToggle();

    if (!FEATURE_PROGRESS_BARS && elements.progressSection) {
      elements.progressSection.classList.add('hidden');
    }
    if (!FEATURE_KEYWORDS_PANEL && elements.keywordsSection) {
      elements.keywordsSection.classList.add('hidden');
    }
    if (!FEATURE_COPY_STATS_JSON && elements.copyStatsBtn) {
      elements.copyStatsBtn.classList.add('hidden');
    }
    if (!FEATURE_COPY_TEXT && elements.copyTextBtn) {
      elements.copyTextBtn.classList.add('hidden');
    }
    if (!FEATURE_READABILITY) {
      elements.fleschValue.textContent = '--';
      elements.fkglValue.textContent = '--';
    }

    elements.textarea.addEventListener('input', debouncedAnalyze);
    elements.analyzeBtn?.addEventListener('click', analyzeText);
    elements.resetBtn?.addEventListener('click', () => {
      elements.textarea.value = '';
      showTruncationNotice(false);
      renderDefaults();
      announce('Input cleared.');
      elements.textarea.focus();
    });
    if (FEATURE_COPY_STATS_JSON) {
      elements.copyStatsBtn?.addEventListener('click', copyStatsJSON);
    }
    if (FEATURE_COPY_TEXT) {
      elements.copyTextBtn?.addEventListener('click', copyText);
    }
    if (FEATURE_KEYWORDS_PANEL) {
      elements.previewToggle?.addEventListener('click', togglePreviewVisibility);
    }

    renderDefaults();
    requestAnimationFrame(() => {
      elements.textarea?.focus({ preventScroll: true });
    });
  };

  init();
})();
